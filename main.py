from datetime import datetime, timedelta
import asyncio
import hashlib
import hmac
import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import SQLModel, Session, select
from sqlalchemy import inspect, text
from database import engine, get_session
from models import (
    User, Patient, Department, Doctor, Appointment, MedicalRecord, Prescription,
    AuditLog, SMSReminder, InpatientService, Room, Bed, BedAssignment,
)

app = FastAPI(title="HBYS Staj Projesi", version="1.0")
sms_worker_task = None

PASSWORD_ITERATIONS = 260_000

# İşlemler role değil izinlere bağlanır. Böylece aynı izin birden fazla
# kullanıcı grubuna verilebilir; yönetici '*' ile tüm izinlere sahiptir.
ROLE_PERMISSIONS = {
    "hasta": {
        "appointment.create",
        "appointment.cancel",
        "patient.view",
        "patient.view.own",
        "medical_record.view.own",
        "prescription.view.own",
    },
    "doktor": {
        "appointment.create",
        "appointment.cancel",
        "appointment.status.update",
        "patient.view",
        "patient.view.assigned",
        "medical_record.create",
        "medical_record.view.assigned",
        "prescription.create",
        "prescription.view.assigned",
        "bed.view",
    },
    "sekreter": {
        "patient.create",
        "patient.view",
        "appointment.create",
        "appointment.cancel",
        "appointment.approve",
        "appointment.reject",
        "appointment.reschedule",
        "appointment.status.update",
        "bed.view",
        "bed.assign",
        "bed.discharge",
    },
    "yonetici": {"*"},
}


def hash_password(password: str) -> str:
    """Her kullanıcı için farklı salt kullanarak PBKDF2-SHA256 hash üretir."""
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Yeni PBKDF2 hashlerini ve geçiş sürecindeki eski SHA-256 hashlerini doğrular."""
    if stored_hash.startswith("pbkdf2_sha256$"):
        try:
            _, iterations, salt_hex, digest_hex = stored_hash.split("$", 3)
            candidate = hashlib.pbkdf2_hmac(
                "sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations)
            ).hex()
            return hmac.compare_digest(candidate, digest_hex)
        except (ValueError, TypeError):
            return False
    legacy_hash = hashlib.sha256(password.encode()).hexdigest()
    return hmac.compare_digest(legacy_hash, stored_hash)


class LoginRequest(BaseModel):
    username: str
    password: str


class PasswordChangeRequest(BaseModel):
    user_id: int
    current_password: str
    new_password: str


class LoginResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    department_id: int | None = None
    doctor_id: int | None = None
    patient_id: int | None = None


class PatientCreateResponse(BaseModel):
    patient: Patient
    username: str
    temporary_password: str


class AppointmentRescheduleRequest(BaseModel):
    appointment_date: datetime


class BedAssignmentRequest(BaseModel):
    bed_id: int
    patient_id: int
    admission_reason: str | None = None


def validate_appointment_working_hours(appointment_date: datetime):
    minute_of_day = appointment_date.hour * 60 + appointment_date.minute
    if minute_of_day < 8 * 60 or minute_of_day > 17 * 60 + 30:
        raise HTTPException(status_code=422, detail="Randevu saati 08:00 ile 17:30 arasında olmalıdır.")
    if appointment_date.minute not in {0, 30}:
        raise HTTPException(status_code=422, detail="Randevular yalnızca tam veya yarım saatlere oluşturulabilir.")


def require_user(session: Session, user_id: int | None, allowed_roles: set[str] | None = None) -> User:
    if not user_id:
        raise HTTPException(status_code=401, detail="Bu işlem için kullanıcı oturumu gereklidir.")
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı oturumu geçersizdir.")
    if allowed_roles and user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz bulunmuyor.")
    return user


def require_permission(session: Session, user_id: int | None, permission: str) -> User:
    """Kullanıcıyı doğrular ve işlemi merkezi izin matrisiyle kontrol eder."""
    user = require_user(session, user_id)
    permissions = ROLE_PERMISSIONS.get(user.role, set())
    if "*" not in permissions and permission not in permissions:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz bulunmuyor.")
    return user


def validate_appointment_relations(session: Session, appointment: Appointment):
    patient = session.get(Patient, appointment.patient_id)
    doctor = session.get(Doctor, appointment.doctor_id)
    department = session.get(Department, appointment.department_id)
    if not patient or not doctor or not department:
        raise HTTPException(status_code=422, detail="Hasta, doktor veya poliklinik kaydı geçersiz.")
    if doctor.department_id != department.id:
        raise HTTPException(status_code=422, detail="Seçilen doktor bu poliklinikte görev yapmıyor.")
    return patient, doctor, department


def create_demo_sms_reminders(session: Session, appointment: Appointment, replace_pending: bool = False):
    if appointment.status in {"Talep Edildi", "İptal", "İptal Edildi", "Reddedildi", "Tamamlandı", "Gelmedi"}:
        return []
    patient = session.get(Patient, appointment.patient_id)
    doctor = session.get(Doctor, appointment.doctor_id)
    department = session.get(Department, appointment.department_id)
    if not patient or not patient.phone:
        return []

    if replace_pending:
        pending = session.exec(select(SMSReminder).where(
            SMSReminder.appointment_id == appointment.id,
            SMSReminder.status == "Bekliyor",
        )).all()
        for reminder in pending:
            session.delete(reminder)
        session.commit()

    appointment_text = appointment.appointment_date.strftime("%d.%m.%Y %H:%M")
    doctor_name = f"Dr. {doctor.first_name} {doctor.last_name}" if doctor else "doktorunuz"
    department_name = department.name if department else "poliklinik"
    templates = [
        ("24 Saat Önce", appointment.appointment_date - timedelta(hours=24)),
        ("2 Saat Önce", appointment.appointment_date - timedelta(hours=2)),
    ]
    created = []
    for reminder_type, scheduled_for in templates:
        existing = session.exec(select(SMSReminder).where(
            SMSReminder.appointment_id == appointment.id,
            SMSReminder.reminder_type == reminder_type,
        )).first()
        if existing or scheduled_for <= datetime.now():
            continue
        message = (
            f"Sayın {patient.first_name} {patient.last_name}, {appointment_text} tarihindeki "
            f"{department_name} randevunuzu hatırlatırız. Doktor: {doctor_name}. HBYS"
        )
        reminder = SMSReminder(
            appointment_id=appointment.id,
            patient_id=patient.id,
            phone=patient.phone,
            reminder_type=reminder_type,
            message=message,
            scheduled_for=scheduled_for,
        )
        session.add(reminder)
        created.append(reminder)
    if created:
        session.commit()
        for reminder in created:
            session.refresh(reminder)
    return created


def process_due_sms_reminders() -> int:
    """Zamanı gelen onaylı demo SMS kayıtlarını otomatik olarak gönderilmiş işaretler."""
    sent_count = 0
    now = datetime.now()
    with Session(engine) as session:
        reminders = session.exec(select(SMSReminder).where(
            SMSReminder.status == "Bekliyor",
            SMSReminder.scheduled_for <= now,
        )).all()

        for reminder in reminders:
            appointment = session.get(Appointment, reminder.appointment_id)
            if not appointment or appointment.status in {"İptal", "İptal Edildi", "Reddedildi", "Tamamlandı", "Gelmedi"}:
                reminder.status = "İptal Edildi"
                session.add(reminder)
                continue
            # Onay akışında randevu önce Onaylandı, doktor çalışma kuyruğuna
            # geçtiğinde ise Bekliyor durumuna gelebilir. Her iki durum da
            # onaylanmış randevu kabul edilir ve SMS gönderilebilir.
            if appointment.status not in {"Onaylandı", "Bekliyor"}:
                continue

            reminder.status = "Gönderildi"
            reminder.sent_at = now
            session.add(reminder)
            session.add(AuditLog(
                action="DEMO_SMS_OTOMATIK_GONDERILDI",
                entity_type="SMSReminder",
                entity_id=reminder.id,
                details=f"{reminder.phone} - {reminder.reminder_type}",
            ))
            sent_count += 1

        if reminders:
            session.commit()
    return sent_count


async def sms_scheduler_loop():
    """Backend çalıştığı sürece her dakika SMS kuyruğunu kontrol eder."""
    while True:
        try:
            await asyncio.to_thread(process_due_sms_reminders)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"SMS otomatik worker hatası: {exc}")
        await asyncio.sleep(60)

# Frontend (React) bağlantısı için CORS izni
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    global sms_worker_task
    SQLModel.metadata.create_all(engine)

    # Eski SQLite veritabanlarını uygulama açılışında geriye dönük uyumlu tut.
    user_columns = {column['name'] for column in inspect(engine).get_columns('user')}
    with engine.begin() as connection:
        for column_name in ('department_id', 'doctor_id', 'patient_id'):
            if column_name not in user_columns:
                connection.execute(text(f'ALTER TABLE "user" ADD COLUMN {column_name} INTEGER'))

    appointment_columns = {column['name'] for column in inspect(engine).get_columns('appointment')}
    appointment_migrations = {
        'request_note': 'TEXT',
        'created_at': 'DATETIME',
        'requested_by_user_id': 'INTEGER',
        'confirmed_by_user_id': 'INTEGER',
    }
    with engine.begin() as connection:
        for column_name, column_type in appointment_migrations.items():
            if column_name not in appointment_columns:
                connection.execute(text(f'ALTER TABLE appointment ADD COLUMN {column_name} {column_type}'))
    
    with Session(engine) as session:
        # Eksik poliklinikleri ekle; mevcut kayıtları silmeden çalışır.
        department_names = [
            "Dahiliye", "Göz Hastalıkları", "Kardiyoloji",
            "Çocuk Sağlığı", "Ortopedi", "Dermatoloji",
        ]
        departments = {}
        for name in department_names:
            department = session.exec(select(Department).where(Department.name == name)).first()
            if not department:
                department = Department(name=name, description=f"{name} polikliniği")
                session.add(department)
                session.commit()
                session.refresh(department)
            departments[name] = department

        # Yataklı servis mimarisi: Servis -> Oda -> Yatak hiyerarşisi.
        # Seed işlemi idempotenttir; uygulama her açıldığında mükerrer kayıt üretmez.
        inpatient_seed = [
            ("Dahiliye Servisi", "2. Kat", "İç Hastalıkları", [("201", "Tek Kişilik", 1), ("202", "İki Kişilik", 2)]),
            ("Cerrahi Servisi", "3. Kat", "Genel Cerrahi", [("301", "Tek Kişilik", 1), ("302", "İki Kişilik", 2)]),
            ("Çocuk Servisi", "4. Kat", "Çocuk Sağlığı", [("401", "İki Kişilik", 2)]),
        ]
        for service_name, floor, specialty, room_seed in inpatient_seed:
            service = session.exec(select(InpatientService).where(InpatientService.name == service_name)).first()
            if not service:
                service = InpatientService(name=service_name, floor=floor, specialty=specialty)
                session.add(service)
                session.commit()
                session.refresh(service)
            for room_number, room_type, capacity in room_seed:
                room = session.exec(select(Room).where(Room.service_id == service.id, Room.room_number == room_number)).first()
                if not room:
                    room = Room(service_id=service.id, room_number=room_number, room_type=room_type, capacity=capacity)
                    session.add(room)
                    session.commit()
                    session.refresh(room)
                for index in range(1, capacity + 1):
                    bed_number = f"{room_number}-{index}"
                    if not session.exec(select(Bed).where(Bed.room_id == room.id, Bed.bed_number == bed_number)).first():
                        session.add(Bed(room_id=room.id, bed_number=bed_number, status="Boş"))
            session.commit()
        for service in session.exec(select(InpatientService)).all():
            service.total_beds = len(session.exec(select(Bed).join(Room, Room.id == Bed.room_id).where(Room.service_id == service.id)).all())
            session.add(service)
        session.commit()

        # Her polikliniğe örnek doktor ekle.
        doctor_seed = [
            ("Ahmet", "Yılmaz", "Dahiliye", "doktor"),
            ("Selin", "Akar", "Dahiliye", "dahiliye_doktor2"),
            ("Bora", "Kılıç", "Dahiliye", "dahiliye_doktor3"),
            ("Ayşe", "Demir", "Göz Hastalıkları", "goz_doktor"),
            ("Burak", "Öz", "Göz Hastalıkları", "goz_doktor2"),
            ("Leyla", "Uçar", "Göz Hastalıkları", "goz_doktor3"),
            ("Mehmet", "Kaya", "Kardiyoloji", "kardiyoloji_doktor"),
            ("İpek", "Çetin", "Kardiyoloji", "kardiyoloji_doktor2"),
            ("Kerem", "Ersoy", "Kardiyoloji", "kardiyoloji_doktor3"),
            ("Elif", "Şahin", "Çocuk Sağlığı", "cocuk_doktor"),
            ("Deniz", "Aksoy", "Çocuk Sağlığı", "cocuk_doktor2"),
            ("Sibel", "Yıldız", "Çocuk Sağlığı", "cocuk_doktor3"),
            ("Can", "Öztürk", "Ortopedi", "ortopedi_doktor"),
            ("Onur", "Eren", "Ortopedi", "ortopedi_doktor2"),
            ("Gizem", "Polat", "Ortopedi", "ortopedi_doktor3"),
            ("Zeynep", "Arslan", "Dermatoloji", "dermatoloji_doktor"),
            ("Murat", "Keskin", "Dermatoloji", "dermatoloji_doktor2"),
            ("Pelin", "Doğan", "Dermatoloji", "dermatoloji_doktor3"),
        ]
        doctors = {}
        for first_name, last_name, department_name, username in doctor_seed:
            doctor = session.exec(
                select(Doctor).where(Doctor.first_name == first_name, Doctor.last_name == last_name)
            ).first()
            if not doctor:
                doctor = Doctor(first_name=first_name, last_name=last_name, department_id=departments[department_name].id)
                session.add(doctor)
                session.commit()
                session.refresh(doctor)
            doctors[username] = doctor

        # Demo kullanıcılarını tek tek kontrol ederek eksik olanları ekle.
        user_seed = [
            ("admin", "admin123", "yonetici", "Sistem Yöneticisi", None, None),
            ("sekreter", "sekreter123", "sekreter", "Ayşe Sekreter", departments["Dahiliye"].id, None),
            ("goz_sekreter", "goz123", "sekreter", "Göz Polikliniği Sekreteri", departments["Göz Hastalıkları"].id, None),
            ("kardiyoloji_sekreter", "kardiyo123", "sekreter", "Kardiyoloji Sekreteri", departments["Kardiyoloji"].id, None),
            ("cocuk_sekreter", "cocuk123", "sekreter", "Çocuk Sağlığı Sekreteri", departments["Çocuk Sağlığı"].id, None),
            ("ortopedi_sekreter", "ortopedi123", "sekreter", "Ortopedi Sekreteri", departments["Ortopedi"].id, None),
            ("dermatoloji_sekreter", "derma123", "sekreter", "Dermatoloji Sekreteri", departments["Dermatoloji"].id, None),
            # Sunumda farklı poliklinik yetkilerini göstermek için isimli demo sekreterleri.
            ("dahiliye_demo", "demo1234", "sekreter", "Elif Kaya", departments["Dahiliye"].id, None),
            ("goz_demo", "demo1234", "sekreter", "Melis Aydın", departments["Göz Hastalıkları"].id, None),
            ("kardiyo_demo", "demo1234", "sekreter", "Zeynep Çelik", departments["Kardiyoloji"].id, None),
            ("cocuk_demo", "demo1234", "sekreter", "Buse Yıldız", departments["Çocuk Sağlığı"].id, None),
            ("ortopedi_demo", "demo1234", "sekreter", "Emre Şahin", departments["Ortopedi"].id, None),
            ("derma_demo", "demo1234", "sekreter", "Seda Arslan", departments["Dermatoloji"].id, None),
        ]
        for username, password, role, full_name, department_id, doctor_id in user_seed:
            if not session.exec(select(User).where(User.username == username)).first():
                session.add(User(username=username, password_hash=hash_password(password), role=role, full_name=full_name, department_id=department_id, doctor_id=doctor_id))

        for first_name, last_name, department_name, username in doctor_seed:
            doctor = doctors[username]
            doctor_user = session.exec(select(User).where(User.username == username)).first()
            password = "doktor123" if username == "doktor" else "demo1234"
            if not doctor_user:
                session.add(User(username=username, password_hash=hash_password(password), role="doktor", full_name=f"Dr. {first_name} {last_name}", department_id=departments[department_name].id, doctor_id=doctor.id))
            elif username != "doktor":
                old_demo_hash = hashlib.sha256(f"HBYS{doctor.id:04d}".encode()).hexdigest()
                if doctor_user.password_hash == old_demo_hash:
                    doctor_user.password_hash = hash_password("demo1234")
                doctor_user.department_id = departments[department_name].id
                doctor_user.doctor_id = doctor.id
                doctor_user.full_name = f"Dr. {first_name} {last_name}"
                session.add(doctor_user)
        session.commit()

        # Önceki sürümde oluşturulmuş kullanıcıları da ilişkilerine bağla.
        existing_secretary = session.exec(select(User).where(User.username == "sekreter")).first()
        existing_doctor = session.exec(select(User).where(User.username == "doktor")).first()
        if existing_secretary:
            existing_secretary.department_id = departments["Dahiliye"].id
        if existing_doctor:
            existing_doctor.department_id = departments["Dahiliye"].id
            existing_doctor.doctor_id = doctors["doktor"].id
        session.commit()

        # Benzersiz TC numaralarıyla örnek hastaları ekle.
        patient_seed = [
            ("Kübra", "Yılmaz", "10000000001", "05550000001", "Kadın"),
            ("Ali", "Yılmaz", "10000000002", "05550000002", "Erkek"),
            ("Nur", "Kaya", "10000000003", "05550000003", "Kadın"),
            ("Mert", "Aydın", "10000000004", "05550000004", "Erkek"),
            ("Seda", "Çelik", "10000000005", "05550000005", "Kadın"),
            ("Emir", "Koç", "10000000006", "05550000006", "Erkek"),
            ("Derya", "Şimşek", "10000000007", "05550000007", "Kadın"),
            ("Ece", "Demir", "10000000008", "05550000008", "Kadın"),
        ]
        patients = []
        for first_name, last_name, tc_no, phone, gender in patient_seed:
            patient = session.exec(select(Patient).where(Patient.tc_no == tc_no)).first()
            if not patient:
                patient = Patient(tc_no=tc_no, first_name=first_name, last_name=last_name, phone=phone, gender=gender)
                session.add(patient)
                session.commit()
                session.refresh(patient)
            patients.append(patient)

        if not session.exec(select(User).where(User.username == "hasta")).first():
            session.add(User(username="hasta", password_hash=hash_password("hasta123"), role="hasta", full_name="Kübra Yılmaz", patient_id=patients[0].id))
            session.commit()

        # Sunumda farklı hasta profillerini göstermek için kolay hatırlanan demo hesapları.
        patient_account_seed = [
            (patients[1], "Ali_hasta", "demo1234"),
            (patients[2], "nur_hasta", "demo1234"),
            (patients[3], "mert_hasta", "demo1234"),
            (patients[4], "seda_hasta", "demo1234"),
            (patients[5], "emir_hasta", "demo1234"),
            (patients[6], "derya_hasta", "demo1234"),
            (patients[7], "ece_hasta", "demo1234"),
        ]
        for patient, username, password in patient_account_seed:
            linked_user = session.exec(select(User).where(User.patient_id == patient.id)).first()
            username_owner = session.exec(select(User).where(User.username == username)).first()
            if username_owner:
                username_owner.patient_id = patient.id
                username_owner.role = "hasta"
                username_owner.full_name = f"{patient.first_name} {patient.last_name}"
                session.add(username_owner)
            elif linked_user and linked_user.username.startswith("hasta"):
                # Eski hasta0002 biçimindeki demo hesabını okunabilir kullanıcı adına geçir.
                linked_user.username = username
                linked_user.password_hash = hash_password(password)
                linked_user.full_name = f"{patient.first_name} {patient.last_name}"
                session.add(linked_user)
            elif not linked_user:
                session.add(User(
                    username=username,
                    password_hash=hash_password(password),
                    role="hasta",
                    full_name=f"{patient.first_name} {patient.last_name}",
                    patient_id=patient.id,
                ))
        session.commit()

        # Sunum ve test kolaylığı için hazır yatan hasta örnekleri.
        # Seed idempotenttir; aynı hasta veya yatak için ikinci yatış oluşturmaz.
        inpatient_demo_plan = [
            (patients[1], "201-1", "Dahiliye gözlem ve tedavi"),
            (patients[2], "301-1", "Ameliyat sonrası takip"),
            (patients[3], "401-1", "Çocuk servisi klinik gözlem"),
        ]
        for demo_patient, bed_number, reason in inpatient_demo_plan:
            active_patient_assignment = session.exec(select(BedAssignment).where(
                BedAssignment.patient_id == demo_patient.id,
                BedAssignment.status == "Yatıyor",
            )).first()
            if active_patient_assignment:
                continue
            target_bed = session.exec(select(Bed).where(Bed.bed_number == bed_number)).first()
            if not target_bed or target_bed.status != "Boş":
                continue
            session.add(BedAssignment(
                bed_id=target_bed.id,
                patient_id=demo_patient.id,
                admission_reason=reason,
                status="Yatıyor",
            ))
            target_bed.status = "Dolu"
            session.add(target_bed)
        session.commit()

        # Örnek gelecek randevuları ekle; aynı kayıt varsa tekrar oluşturmaz.
        appointment_plan = [
            (0, "doktor", 1, 10, 0, "Bekliyor"), (1, "goz_doktor", 2, 11, 30, "Onaylandı"),
            (2, "kardiyoloji_doktor", 3, 9, 30, "Bekliyor"), (3, "cocuk_doktor", 4, 13, 0, "Onaylandı"),
            (4, "ortopedi_doktor", 5, 14, 0, "Bekliyor"), (5, "dermatoloji_doktor", 6, 15, 30, "Onaylandı"),
            # Takvim görünümünü gerçekçi örnek verilerle zenginleştiren ek kayıtlar.
            (6, "doktor", 1, 11, 30, "Onaylandı"), (7, "dahiliye_doktor2", 1, 14, 0, "Bekliyor"),
            (1, "dahiliye_doktor3", 2, 9, 0, "Onaylandı"), (2, "goz_doktor2", 2, 15, 0, "Bekliyor"),
            (3, "kardiyoloji_doktor2", 3, 10, 30, "Onaylandı"), (4, "cocuk_doktor2", 3, 14, 30, "Bekliyor"),
            (5, "ortopedi_doktor2", 4, 9, 30, "Onaylandı"), (6, "dermatoloji_doktor2", 4, 16, 0, "Bekliyor"),
            (7, "doktor", 5, 9, 30, "Onaylandı"), (0, "dahiliye_doktor2", 5, 13, 0, "Bekliyor"),
            (2, "goz_doktor", 6, 10, 0, "Onaylandı"), (3, "kardiyoloji_doktor", 7, 11, 0, "Bekliyor"),
            (4, "cocuk_doktor3", 7, 15, 30, "Onaylandı"), (5, "ortopedi_doktor3", 8, 10, 30, "Bekliyor"),
            (6, "dermatoloji_doktor3", 8, 14, 0, "Onaylandı"), (7, "dahiliye_doktor3", 9, 16, 30, "Bekliyor"),
        ]
        for patient_index, doctor_key, days_ahead, hour, minute, status in appointment_plan:
            doctor = doctors[doctor_key]
            appointment_date = (datetime.now() + timedelta(days=days_ahead + 1)).replace(hour=hour, minute=minute, second=0, microsecond=0)
            exists = session.exec(select(Appointment).where(Appointment.patient_id == patients[patient_index].id, Appointment.doctor_id == doctor.id, Appointment.appointment_date == appointment_date)).first()
            if not exists:
                session.add(Appointment(patient_id=patients[patient_index].id, doctor_id=doctor.id, department_id=doctor.department_id, appointment_date=appointment_date, status=status))
        session.commit()

        # Mevcut ve yeni gelecek randevular için eksik demo SMS kayıtlarını hazırla.
        future_appointments = session.exec(select(Appointment).where(Appointment.appointment_date > datetime.now())).all()
        for appointment in future_appointments:
            create_demo_sms_reminders(session, appointment)

    # Gerçek SMS servisi kullanılmadan demo kuyruğunu otomatik işleyen görev.
    sms_worker_task = asyncio.get_running_loop().create_task(sms_scheduler_loop())


@app.on_event("shutdown")
async def on_shutdown():
    global sms_worker_task
    if sms_worker_task:
        sms_worker_task.cancel()
        try:
            await sms_worker_task
        except asyncio.CancelledError:
            pass
        sms_worker_task = None


@app.get("/")
def read_root():
    return {"message": "HBYS Backend Sistemine Hoş Geldiniz:)"}


@app.post("/auth/login", response_model=LoginResponse)
def login(credentials: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(
        select(User).where(User.username == credentials.username.strip())
    ).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Kullanıcı adı veya şifre hatalı.")

    if not user.password_hash.startswith("pbkdf2_sha256$"):
        user.password_hash = hash_password(credentials.password)
        session.add(user)
        session.commit()

    return LoginResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        department_id=user.department_id,
        doctor_id=user.doctor_id,
        patient_id=user.patient_id,
    )


@app.post("/auth/change-password")
def change_password(request: PasswordChangeRequest, session: Session = Depends(get_session)):
    user = session.get(User, request.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    if not verify_password(request.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="Mevcut şifre hatalı.")
    if len(request.new_password) < 8:
        raise HTTPException(status_code=422, detail="Yeni şifre en az 8 karakter olmalıdır.")
    if request.current_password == request.new_password:
        raise HTTPException(status_code=422, detail="Yeni şifre mevcut şifreden farklı olmalıdır.")
    user.password_hash = hash_password(request.new_password)
    session.add(user)
    session.commit()
    session.add(AuditLog(user_id=user.id, action="SIFRE_DEGISTIRILDI", entity_type="User", entity_id=user.id))
    session.commit()
    return {"message": "Şifreniz başarıyla değiştirildi."}

# 👤 --- Hasta (Patient) Endpointleri ---
@app.post("/patients/", response_model=PatientCreateResponse)
def create_patient(patient: Patient, user_id: int | None = None, session: Session = Depends(get_session)):
    actor = require_permission(session, user_id, "patient.create")
    patient.id = None
    patient.tc_no = patient.tc_no.strip()
    patient.first_name = patient.first_name.strip()
    patient.last_name = patient.last_name.strip()
    patient.phone = patient.phone.strip() if patient.phone else None
    if len(patient.tc_no) != 11 or not patient.tc_no.isdigit():
        raise HTTPException(status_code=422, detail="TC kimlik numarası 11 haneli ve yalnızca rakamlardan oluşmalıdır.")
    if not patient.first_name or not patient.last_name:
        raise HTTPException(status_code=422, detail="Hasta adı ve soyadı zorunludur.")
    if patient.phone and (not patient.phone.isdigit() or len(patient.phone) != 11):
        raise HTTPException(status_code=422, detail="Telefon numarası 11 haneli olmalıdır.")
    if session.exec(select(Patient).where(Patient.tc_no == patient.tc_no)).first():
        raise HTTPException(status_code=409, detail="Bu TC kimlik numarasıyla kayıtlı bir hasta zaten var.")

    session.add(patient)
    session.commit()
    session.refresh(patient)

    username = f"hasta{patient.id:04d}"
    temporary_password = f"HBYS{patient.tc_no[-4:]}"
    session.add(User(
        username=username,
        password_hash=hash_password(temporary_password),
        role="hasta",
        full_name=f"{patient.first_name} {patient.last_name}",
        patient_id=patient.id,
    ))
    session.commit()
    session.add(AuditLog(user_id=actor.id, action="HASTA_OLUSTURULDU", entity_type="Patient", entity_id=patient.id, details=f"{patient.first_name} {patient.last_name}"))
    session.commit()
    return PatientCreateResponse(
        patient=patient,
        username=username,
        temporary_password=temporary_password,
    )

@app.get("/patients/", response_model=list[Patient])
def get_patients(
    patient_id: int | None = None,
    user_id: int | None = None,
    session: Session = Depends(get_session),
):
    actor = require_permission(session, user_id, "patient.view")
    query = select(Patient)
    if actor.role == "hasta":
        if actor.patient_id is None:
            return []
        query = query.where(Patient.id == actor.patient_id)
    elif actor.role == "sekreter":
        # Hasta kayıtları hastanenin ortak hasta kartotekidir; sekreterin
        # bağlı polikliniği randevu ve işlem ekranlarını sınırlar.
        pass
    elif actor.role == "doktor":
        query = query.join(Appointment, Appointment.patient_id == Patient.id).where(
            Appointment.doctor_id == actor.doctor_id
        ).distinct()
    if patient_id:
        query = query.where(Patient.id == patient_id)
    return session.exec(query).all()

# 🏢 --- Poliklinik (Department) Endpointleri ---
@app.post("/departments/", response_model=Department)
def create_department(department: Department, session: Session = Depends(get_session)):
    session.add(department)
    session.commit()
    session.refresh(department)
    return department

@app.get("/departments/", response_model=list[Department])
def get_departments(session: Session = Depends(get_session)):
    return session.exec(select(Department)).all()

# 🩺 --- Doktor (Doctor) Endpointleri ---
@app.post("/doctors/", response_model=Doctor)
def create_doctor(doctor: Doctor, session: Session = Depends(get_session)):
    session.add(doctor)
    session.commit()
    session.refresh(doctor)
    return doctor

@app.get("/doctors/", response_model=list[Doctor])
def get_doctors(session: Session = Depends(get_session)):
    return session.exec(select(Doctor)).all()


# 🛏️ --- Yataklı Servis ve Yatış Endpointleri ---
def serialize_bed(session: Session, bed: Bed):
    room = session.get(Room, bed.room_id)
    service = session.get(InpatientService, room.service_id) if room else None
    assignment = session.exec(select(BedAssignment).where(
        BedAssignment.bed_id == bed.id,
        BedAssignment.status == "Yatıyor",
    )).first()
    patient = session.get(Patient, assignment.patient_id) if assignment else None
    return {
        "id": bed.id,
        "bed_number": bed.bed_number,
        "status": bed.status,
        "active": bed.active,
        "room_id": room.id if room else None,
        "room_number": room.room_number if room else "-",
        "room_type": room.room_type if room else "-",
        "service_id": service.id if service else None,
        "service_name": service.name if service else "-",
        "floor": service.floor if service else "-",
        "assignment_id": assignment.id if assignment else None,
        "patient_id": patient.id if patient else None,
        "patient_name": f"{patient.first_name} {patient.last_name}" if patient else None,
    }


@app.get("/inpatient-services/")
def get_inpatient_services(user_id: int | None = None, session: Session = Depends(get_session)):
    require_permission(session, user_id, "bed.view")
    services = session.exec(select(InpatientService).where(InpatientService.active == True)).all()
    result = []
    for service in services:
        rooms = session.exec(select(Room).where(Room.service_id == service.id, Room.active == True)).all()
        beds = [bed for room in rooms for bed in session.exec(select(Bed).where(Bed.room_id == room.id, Bed.active == True)).all()]
        result.append({
            "id": service.id,
            "name": service.name,
            "floor": service.floor,
            "specialty": service.specialty,
            "total_beds": len(beds),
            "occupied_beds": sum(1 for bed in beds if bed.status == "Dolu"),
            "available_beds": sum(1 for bed in beds if bed.status == "Boş"),
            "cleaning_beds": sum(1 for bed in beds if bed.status == "Temizlikte"),
        })
    return result


@app.get("/beds/")
def get_beds(service_id: int | None = None, user_id: int | None = None, session: Session = Depends(get_session)):
    require_permission(session, user_id, "bed.view")
    query = select(Bed).where(Bed.active == True)
    if service_id:
        query = query.join(Room, Room.id == Bed.room_id).where(Room.service_id == service_id)
    return [serialize_bed(session, bed) for bed in session.exec(query).all()]


@app.patch("/beds/{bed_id}/status")
def update_bed_status(bed_id: int, status: str, user_id: int | None = None, session: Session = Depends(get_session)):
    actor = require_permission(session, user_id, "bed.status.update")
    if status not in {"Boş", "Temizlikte", "Bakıma Ayrıldı"}:
        raise HTTPException(status_code=422, detail="Geçersiz yatak durumu.")
    bed = session.get(Bed, bed_id)
    if not bed:
        raise HTTPException(status_code=404, detail="Yatak bulunamadı.")
    if status == "Boş" and session.exec(select(BedAssignment).where(BedAssignment.bed_id == bed.id, BedAssignment.status == "Yatıyor")).first():
        raise HTTPException(status_code=409, detail="Yatan hasta bulunan yatak boş yapılamaz.")
    previous_status = bed.status
    bed.status = status
    session.add(bed)
    session.commit()
    session.refresh(bed)
    session.add(AuditLog(user_id=actor.id, action="YATAK_DURUMU_GUNCELLENDI", entity_type="Bed", entity_id=bed.id, details=f"{previous_status} -> {status}"))
    session.commit()
    return serialize_bed(session, bed)


@app.post("/bed-assignments/")
def assign_bed(payload: BedAssignmentRequest, user_id: int | None = None, session: Session = Depends(get_session)):
    actor = require_permission(session, user_id, "bed.assign")
    bed = session.get(Bed, payload.bed_id)
    patient = session.get(Patient, payload.patient_id)
    if not bed or not bed.active or not patient:
        raise HTTPException(status_code=404, detail="Aktif yatak veya hasta bulunamadı.")
    if bed.status != "Boş":
        raise HTTPException(status_code=409, detail="Bu yatak şu anda boş değil.")
    existing_patient = session.exec(select(BedAssignment).where(
        BedAssignment.patient_id == patient.id,
        BedAssignment.status == "Yatıyor",
    )).first()
    if existing_patient:
        raise HTTPException(status_code=409, detail="Bu hasta zaten başka bir yatakta yatıyor.")
    assignment = BedAssignment(bed_id=bed.id, patient_id=patient.id, admission_reason=payload.admission_reason)
    bed.status = "Dolu"
    session.add(assignment)
    session.add(bed)
    session.commit()
    session.refresh(assignment)
    session.add(AuditLog(user_id=actor.id, action="HASTA_YATAGA_YATIRILDI", entity_type="BedAssignment", entity_id=assignment.id, details=f"Hasta: {patient.id}, Yatak: {bed.bed_number}"))
    session.commit()
    return {"assignment": assignment, "bed": serialize_bed(session, bed)}


@app.patch("/bed-assignments/{assignment_id}/discharge")
def discharge_patient(assignment_id: int, user_id: int | None = None, session: Session = Depends(get_session)):
    actor = require_permission(session, user_id, "bed.discharge")
    assignment = session.get(BedAssignment, assignment_id)
    if not assignment or assignment.status != "Yatıyor":
        raise HTTPException(status_code=404, detail="Aktif yatış kaydı bulunamadı.")
    bed = session.get(Bed, assignment.bed_id)
    assignment.status = "Taburcu Edildi"
    assignment.discharged_at = datetime.utcnow()
    if bed:
        # Demo HBYS akışında taburcu işlemi sonrası temizlik süreci otomatik
        # tamamlanmış kabul edilir; sekreterin ikinci bir işlem yapmasına gerek kalmaz.
        bed.status = "Boş"
        session.add(bed)
    session.add(assignment)
    session.commit()
    session.add(AuditLog(user_id=actor.id, action="HASTA_TABURCU_EDILDI", entity_type="BedAssignment", entity_id=assignment.id, details=f"Yatak: {bed.bed_number if bed else assignment.bed_id}"))
    session.commit()
    return {"assignment": assignment, "bed": serialize_bed(session, bed) if bed else None}

# 📅 --- Randevu (Appointment) Endpointleri ---
@app.post("/appointments/", response_model=Appointment)
def create_appointment(
    appointment: Appointment,
    user_id: int | None = None,
    session: Session = Depends(get_session),
):
    actor = require_permission(session, user_id, "appointment.create")
    # SQLite DateTime alanı string kabul etmez. Gelen değeri önce datetime
    # nesnesine çevirip timezone bilgisini sadeleştiriyoruz.
    raw_date = appointment.appointment_date
    try:
        parsed_date = raw_date if isinstance(raw_date, datetime) else datetime.fromisoformat(
            str(raw_date).replace("Z", "+00:00")
        )

        # SQLite projesinde tarihleri timezone'suz (naive) saklıyoruz.
        if parsed_date.tzinfo is not None:
            parsed_date = parsed_date.astimezone().replace(tzinfo=None)

        appointment.appointment_date = parsed_date
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=422,
            detail="appointment_date ISO formatında olmalıdır. Örnek: 2026-09-25T10:30:00",
        )

    if appointment.appointment_date < datetime.now():
        raise HTTPException(
            status_code=400,
            detail="Geçmiş bir tarih ve saate randevu alınamaz.",
        )

    validate_appointment_working_hours(appointment.appointment_date)
    validate_appointment_relations(session, appointment)
    if actor.role == "hasta":
        if actor.patient_id != appointment.patient_id:
            raise HTTPException(status_code=403, detail="Hasta yalnızca kendi adına randevu talep edebilir.")
        appointment.status = "Talep Edildi"
    elif actor.role == "doktor":
        if actor.doctor_id != appointment.doctor_id:
            raise HTTPException(status_code=403, detail="Doktor yalnızca kendi randevuları için işlem yapabilir.")
        appointment.status = "Onaylandı"
    elif actor.role == "sekreter":
        if actor.department_id != appointment.department_id:
            raise HTTPException(status_code=403, detail="Sekreter yalnızca bağlı olduğu poliklinik için randevu oluşturabilir.")
        appointment.status = "Onaylandı"
    else:
        appointment.status = "Onaylandı"
    appointment.requested_by_user_id = actor.id

    # İptal edilmiş randevular aynı saate yeniden randevu alınmasına engel olmaz.
    doctor_conflict = session.exec(
        select(Appointment).where(
            Appointment.doctor_id == appointment.doctor_id,
            Appointment.appointment_date == appointment.appointment_date,
            Appointment.status.notin_(
                ["İptal", "İptal Edildi", "Reddedildi"]
            ),
        )
    ).first()

    if doctor_conflict:
        raise HTTPException(
            status_code=409,
            detail="Doktorun bu tarih ve saatte başka bir randevusu bulunmaktadır.",
        )

    patient_conflict = session.exec(
        select(Appointment).where(
            Appointment.patient_id == appointment.patient_id,
            Appointment.appointment_date == appointment.appointment_date,
            Appointment.status.notin_(
                ["İptal", "İptal Edildi", "Reddedildi"]
            ),
        )
    ).first()

    if patient_conflict:
        raise HTTPException(
            status_code=409,
            detail="Hastanın bu tarih ve saatte başka bir randevusu bulunmaktadır.",
        )

    session.add(appointment)
    session.commit()
    session.refresh(appointment)
    session.add(AuditLog(action="RANDEVU_OLUSTURULDU", entity_type="Appointment", entity_id=appointment.id, details=f"Durum: {appointment.status}"))
    session.commit()
    create_demo_sms_reminders(session, appointment)
    return appointment

@app.get("/appointments/", response_model=list[Appointment])
def get_appointments(
    doctor_id: int | None = None,
    department_id: int | None = None,
    patient_id: int | None = None,
    session: Session = Depends(get_session),
):
    query = select(Appointment)
    if doctor_id:
        query = query.where(Appointment.doctor_id == doctor_id)
    if department_id:
        query = query.where(Appointment.department_id == department_id)
    if patient_id:
        query = query.where(Appointment.patient_id == patient_id)
    return session.exec(query).all()

@app.get("/appointments/{appointment_id}", response_model=Appointment)
def get_appointment(appointment_id: int, session: Session = Depends(get_session)):
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")
    return appointment


@app.patch("/appointments/{appointment_id}/reschedule", response_model=Appointment)
def reschedule_appointment(
    appointment_id: int,
    payload: AppointmentRescheduleRequest,
    user_id: int,
    session: Session = Depends(get_session),
):
    user = require_permission(session, user_id, "appointment.reschedule")
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu veya kullanıcı bulunamadı.")

    is_department_secretary = user.role == "sekreter" and user.department_id == appointment.department_id
    if not is_department_secretary and user.role != "yonetici":
        raise HTTPException(status_code=403, detail="Bu randevuyu değiştirme yetkiniz yok.")

    terminal_statuses = {"Muayenede", "Tamamlandı", "İptal", "İptal Edildi", "Reddedildi", "Gelmedi"}
    if appointment.status in terminal_statuses:
        raise HTTPException(status_code=409, detail=f"{appointment.status} durumundaki randevu yeniden planlanamaz.")

    new_date = payload.appointment_date
    if new_date.tzinfo is not None:
        new_date = new_date.astimezone().replace(tzinfo=None)
    if new_date < datetime.now():
        raise HTTPException(status_code=400, detail="Randevu geçmiş bir tarih veya saate taşınamaz.")

    validate_appointment_working_hours(new_date)

    doctor_conflict = session.exec(
        select(Appointment).where(
            Appointment.id != appointment.id,
            Appointment.doctor_id == appointment.doctor_id,
            Appointment.appointment_date == new_date,
            Appointment.status.notin_(["İptal", "İptal Edildi", "Reddedildi"]),
        )
    ).first()
    if doctor_conflict:
        raise HTTPException(status_code=409, detail="Doktorun seçilen tarih ve saatte başka bir randevusu var.")

    patient_conflict = session.exec(
        select(Appointment).where(
            Appointment.id != appointment.id,
            Appointment.patient_id == appointment.patient_id,
            Appointment.appointment_date == new_date,
            Appointment.status.notin_(["İptal", "İptal Edildi", "Reddedildi"]),
        )
    ).first()
    if patient_conflict:
        raise HTTPException(status_code=409, detail="Hastanın seçilen tarih ve saatte başka bir randevusu var.")

    previous_date = appointment.appointment_date
    appointment.appointment_date = new_date
    session.add(appointment)
    session.commit()
    session.refresh(appointment)
    session.add(AuditLog(
        user_id=user.id,
        action="RANDEVU_YENIDEN_PLANLANDI",
        entity_type="Appointment",
        entity_id=appointment.id,
        details=f"{previous_date.isoformat()} -> {new_date.isoformat()}",
    ))
    session.commit()
    create_demo_sms_reminders(session, appointment, replace_pending=True)
    return appointment


@app.put("/appointments/{appointment_id}/cancel", response_model=Appointment)
def cancel_appointment(appointment_id: int, user_id: int | None = None, session: Session = Depends(get_session)):
    actor = require_permission(session, user_id, "appointment.cancel")
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")
    if actor.role == "hasta" and actor.patient_id != appointment.patient_id:
        raise HTTPException(status_code=403, detail="Hasta yalnızca kendi randevusunu iptal edebilir.")
    if actor.role == "sekreter" and actor.department_id != appointment.department_id:
        raise HTTPException(status_code=403, detail="Sekreter yalnızca bağlı olduğu polikliniğin randevusunu iptal edebilir.")
    if actor.role == "doktor" and actor.doctor_id != appointment.doctor_id:
        raise HTTPException(status_code=403, detail="Doktor yalnızca kendi randevusunu iptal edebilir.")
    if appointment.status == "Tamamlandı":
        raise HTTPException(status_code=409, detail="Tamamlanmış randevu iptal edilemez.")
    appointment.status = "İptal Edildi"
    session.add(appointment)
    session.commit()
    session.refresh(appointment)
    session.add(AuditLog(user_id=user_id, action="RANDEVU_IPTAL_EDILDI", entity_type="Appointment", entity_id=appointment.id))
    pending_reminders = session.exec(select(SMSReminder).where(
        SMSReminder.appointment_id == appointment.id,
        SMSReminder.status == "Bekliyor",
    )).all()
    for reminder in pending_reminders:
        reminder.status = "İptal Edildi"
        session.add(reminder)
    session.commit()
    return appointment

@app.patch("/appointments/{appointment_id}/status", response_model=Appointment)
def update_appointment_status(appointment_id: int, status: str, user_id: int | None = None, session: Session = Depends(get_session)):
    actor = require_permission(session, user_id, "appointment.status.update")
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")
    if actor.role == "doktor" and actor.doctor_id != appointment.doctor_id:
        raise HTTPException(status_code=403, detail="Doktor yalnızca kendi randevusunun durumunu değiştirebilir.")
    if actor.role == "sekreter" and actor.department_id != appointment.department_id:
        raise HTTPException(status_code=403, detail="Sekreter yalnızca bağlı olduğu polikliniğin randevularını yönetebilir.")
    if status in {"Muayenede", "Tamamlandı"} and actor.role != "doktor":
        raise HTTPException(status_code=403, detail="Muayene durumlarını yalnızca doktor güncelleyebilir.")

    allowed_statuses = {"Talep Edildi", "Onaylandı", "Reddedildi", "Bekliyor", "Muayenede", "Tamamlandı", "İptal Edildi", "Gelmedi"}
    if status not in allowed_statuses:
        raise HTTPException(status_code=422, detail="Geçersiz randevu durumu.")

    if status == "Muayenede" and appointment.appointment_date > datetime.now():
        raise HTTPException(status_code=409, detail="Randevu zamanı henüz gelmedi; muayene randevu saatinde başlatılabilir.")

    valid_transitions = {
        "Talep Edildi": {"Onaylandı", "İptal Edildi"},
        "Onaylandı": {"Bekliyor", "İptal Edildi"},
        "Bekliyor": {"Muayenede", "İptal Edildi", "Gelmedi"},
        "Muayenede": {"Tamamlandı"},
        "Tamamlandı": set(),
        "İptal Edildi": set(),
        "Gelmedi": set(),
        "Reddedildi": set(),
    }
    if status != appointment.status and status not in valid_transitions.get(appointment.status, set()):
        raise HTTPException(status_code=409, detail=f"{appointment.status} durumundan {status} durumuna geçiş yapılamaz.")

    previous_status = appointment.status
    appointment.status = status
    if status == "Onaylandı" and user_id:
        appointment.confirmed_by_user_id = user_id
    session.add(appointment)
    session.commit()
    session.refresh(appointment)
    session.add(AuditLog(user_id=user_id, action="RANDEVU_DURUMU_GUNCELLENDI", entity_type="Appointment", entity_id=appointment.id, details=f"{previous_status} -> {status}"))
    session.commit()
    return appointment


def change_requested_appointment(appointment_id: int, user_id: int, new_status: str, session: Session):
    appointment = session.get(Appointment, appointment_id)
    user = session.get(User, user_id)
    if not appointment or not user:
        raise HTTPException(status_code=404, detail="Randevu veya kullanıcı bulunamadı.")
    if user.role != "sekreter" or user.department_id != appointment.department_id:
        raise HTTPException(status_code=403, detail="Bu randevu için işlem yetkiniz yok.")
    if appointment.status != "Talep Edildi":
        raise HTTPException(status_code=409, detail="Yalnızca talep edilmiş randevular onaylanabilir veya reddedilebilir.")
    appointment.status = new_status
    appointment.confirmed_by_user_id = user.id
    session.add(appointment)
    session.commit()
    session.refresh(appointment)
    session.add(AuditLog(user_id=user.id, action=f"RANDEVU_{new_status.upper()}", entity_type="Appointment", entity_id=appointment.id))
    session.commit()
    if new_status == "Onaylandı":
        create_demo_sms_reminders(session, appointment)
    else:
        pending_reminders = session.exec(select(SMSReminder).where(
            SMSReminder.appointment_id == appointment.id,
            SMSReminder.status == "Bekliyor",
        )).all()
        for reminder in pending_reminders:
            reminder.status = "İptal Edildi"
            session.add(reminder)
        session.commit()
    return appointment


@app.patch("/appointments/{appointment_id}/approve", response_model=Appointment)
def approve_appointment(appointment_id: int, user_id: int, session: Session = Depends(get_session)):
    return change_requested_appointment(appointment_id, user_id, "Onaylandı", session)


@app.patch("/appointments/{appointment_id}/reject", response_model=Appointment)
def reject_appointment(appointment_id: int, user_id: int, session: Session = Depends(get_session)):
    return change_requested_appointment(appointment_id, user_id, "Reddedildi", session)


@app.get("/sms-reminders/", response_model=list[SMSReminder])
def get_sms_reminders(
    user_id: int,
    department_id: int | None = None,
    status: str | None = None,
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    query = select(SMSReminder)
    if user.role == "hasta":
        if not user.patient_id:
            return []
        query = query.where(SMSReminder.patient_id == user.patient_id)
    elif user.role == "sekreter":
        if not user.department_id:
            return []
        query = query.join(Appointment, SMSReminder.appointment_id == Appointment.id).where(
            Appointment.department_id == user.department_id
        )
    elif user.role not in {"yonetici"}:
        raise HTTPException(status_code=403, detail="SMS bildirimlerini görüntüleme yetkiniz yok.")
    elif department_id:
        query = query.join(Appointment, SMSReminder.appointment_id == Appointment.id).where(
            Appointment.department_id == department_id
        )
    if status:
        query = query.where(SMSReminder.status == status)
    return session.exec(query.order_by(SMSReminder.scheduled_for)).all()


@app.post("/sms-reminders/{reminder_id}/simulate-send", response_model=SMSReminder)
def simulate_sms_send(reminder_id: int, user_id: int, session: Session = Depends(get_session)):
    reminder = session.get(SMSReminder, reminder_id)
    user = session.get(User, user_id)
    if not reminder or not user:
        raise HTTPException(status_code=404, detail="SMS hatırlatması veya kullanıcı bulunamadı.")
    appointment = session.get(Appointment, reminder.appointment_id)
    is_department_secretary = appointment and user.role == "sekreter" and user.department_id == appointment.department_id
    if not is_department_secretary and user.role != "yonetici":
        raise HTTPException(status_code=403, detail="Bu SMS kaydı için işlem yetkiniz yok.")
    if reminder.status == "İptal Edildi":
        raise HTTPException(status_code=409, detail="İptal edilmiş SMS hatırlatması gönderilemez.")
    reminder.status = "Gönderildi"
    reminder.sent_at = datetime.now()
    session.add(reminder)
    session.commit()
    session.refresh(reminder)
    session.add(AuditLog(
        user_id=user.id,
        action="DEMO_SMS_GONDERILDI",
        entity_type="SMSReminder",
        entity_id=reminder.id,
        details=f"{reminder.phone} - {reminder.reminder_type}",
    ))
    session.commit()
    return reminder


@app.post("/sms-reminders/actions/simulate-due", response_model=list[SMSReminder])
def simulate_due_sms(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user or user.role not in {"sekreter", "yonetici"}:
        raise HTTPException(status_code=403, detail="SMS kuyruğunu çalıştırma yetkiniz yok.")
    query = select(SMSReminder).where(
        SMSReminder.status == "Bekliyor",
        SMSReminder.scheduled_for <= datetime.now(),
    )
    if user.role == "sekreter":
        query = query.join(Appointment, SMSReminder.appointment_id == Appointment.id).where(
            Appointment.department_id == user.department_id
        )
    reminders = session.exec(query).all()
    for reminder in reminders:
        reminder.status = "Gönderildi"
        reminder.sent_at = datetime.now()
        session.add(reminder)
        session.add(AuditLog(
            user_id=user.id,
            action="DEMO_SMS_GONDERILDI",
            entity_type="SMSReminder",
            entity_id=reminder.id,
            details=f"{reminder.phone} - otomatik simülasyon",
        ))
    session.commit()
    for reminder in reminders:
        session.refresh(reminder)
    return reminders


@app.get("/audit-logs/", response_model=list[AuditLog])
def get_audit_logs(session: Session = Depends(get_session)):
    return session.exec(select(AuditLog).order_by(AuditLog.created_at.desc())).all()


@app.post("/medical-records/", response_model=MedicalRecord)
def create_medical_record(record: MedicalRecord, user_id: int | None = None, session: Session = Depends(get_session)):
    actor = require_permission(session, user_id, "medical_record.create")
    appointment = session.get(Appointment, record.appointment_id)
    if not appointment or appointment.doctor_id != actor.doctor_id:
        raise HTTPException(status_code=403, detail="Bu randevu için muayene kaydı oluşturma yetkiniz yok.")
    if appointment.status != "Muayenede":
        raise HTTPException(status_code=409, detail="Muayene kaydı yalnızca muayene durumundaki randevuya eklenebilir.")
    if session.exec(select(MedicalRecord).where(MedicalRecord.appointment_id == record.appointment_id)).first():
        raise HTTPException(status_code=409, detail="Bu randevu için zaten bir muayene kaydı bulunuyor.")
    session.add(record)
    session.commit()
    session.refresh(record)
    session.add(AuditLog(user_id=user_id, action="MUAYENE_OLUSTURULDU", entity_type="MedicalRecord", entity_id=record.id, details=f"Randevu: {record.appointment_id}"))
    session.commit()
    return record

@app.get("/medical-records/", response_model=list[MedicalRecord])
def get_medical_records(patient_id: int | None = None, doctor_id: int | None = None, session: Session = Depends(get_session)):
    query = select(MedicalRecord)
    if patient_id or doctor_id:
        query = query.join(Appointment, MedicalRecord.appointment_id == Appointment.id)
        if patient_id:
            query = query.where(Appointment.patient_id == patient_id)
        if doctor_id:
            query = query.where(Appointment.doctor_id == doctor_id)
    return session.exec(query).all()


@app.post("/prescriptions/", response_model=Prescription)
def create_prescription(prescription: Prescription, user_id: int | None = None, session: Session = Depends(get_session)):
    actor = require_permission(session, user_id, "prescription.create")
    record = session.get(MedicalRecord, prescription.medical_record_id)
    appointment = session.get(Appointment, record.appointment_id) if record else None
    if not record or not appointment or appointment.doctor_id != actor.doctor_id:
        raise HTTPException(status_code=403, detail="Bu muayene için reçete yazma yetkiniz yok.")
    session.add(prescription)
    session.commit()
    session.refresh(prescription)
    session.add(AuditLog(user_id=user_id, action="RECETE_OLUSTURULDU", entity_type="Prescription", entity_id=prescription.id, details=prescription.medicine_name))
    session.commit()
    return prescription

@app.get("/prescriptions/", response_model=list[Prescription])
def get_prescriptions(patient_id: int | None = None, doctor_id: int | None = None, session: Session = Depends(get_session)):
    query = select(Prescription)
    if patient_id or doctor_id:
        query = query.join(MedicalRecord, Prescription.medical_record_id == MedicalRecord.id).join(Appointment, MedicalRecord.appointment_id == Appointment.id)
        if patient_id:
            query = query.where(Appointment.patient_id == patient_id)
        if doctor_id:
            query = query.where(Appointment.doctor_id == doctor_id)
    return session.exec(query).all()

@app.get("/medical-records/{record_id}/prescriptions", response_model=list[Prescription])
def get_prescriptions_by_record(record_id: int, session: Session = Depends(get_session)):
    query = select(Prescription).where(Prescription.medical_record_id == record_id)
    return session.exec(query).all()
