from datetime import datetime, timedelta
import hashlib
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import SQLModel, Session, select
from sqlalchemy import inspect, text
from database import engine, get_session
from models import User, Patient, Department, Doctor, Appointment, MedicalRecord, Prescription, AuditLog

app = FastAPI(title="HBYS Staj Projesi", version="1.0")


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
    SQLModel.metadata.create_all(engine)

    # Mevcut SQLite veritabanlarında yeni User kolonlarını güvenli biçimde ekle.
    existing_columns = {column['name'] for column in inspect(engine).get_columns('user')}
    with engine.begin() as connection:
        if 'department_id' not in existing_columns:
            connection.execute(text('ALTER TABLE "user" ADD COLUMN department_id INTEGER'))
        if 'doctor_id' not in existing_columns:
            connection.execute(text('ALTER TABLE "user" ADD COLUMN doctor_id INTEGER'))
        if 'patient_id' not in existing_columns:
            connection.execute(text('ALTER TABLE "user" ADD COLUMN patient_id INTEGER'))

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

        # Her polikliniğe örnek doktor ekle.
        doctor_seed = [
            ("Ahmet", "Yılmaz", "Dahiliye", "doktor"),
            ("Selin", "Akar", "Dahiliye", "dahiliye_doktor2"),
            ("Bora", "Kılıç", "Dahiliye", "dahiliye_doktor3"),
            ("Ayşe", "Demir", "Göz Hastalıkları", "goz_doktor"),
            ("Burak", "Öz", "Göz Hastalıkları", "goz_doktor2"),
            ("Mehmet", "Kaya", "Kardiyoloji", "kardiyoloji_doktor"),
            ("İpek", "Çetin", "Kardiyoloji", "kardiyoloji_doktor2"),
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
        ]
        for username, password, role, full_name, department_id, doctor_id in user_seed:
            if not session.exec(select(User).where(User.username == username)).first():
                session.add(User(username=username, password_hash=hashlib.sha256(password.encode()).hexdigest(), role=role, full_name=full_name, department_id=department_id, doctor_id=doctor_id))

        for first_name, last_name, department_name, username in doctor_seed:
            doctor = doctors[username]
            if not session.exec(select(User).where(User.username == username)).first():
                password = "doktor123" if username == "doktor" else f"HBYS{doctor.id:04d}"
                session.add(User(username=username, password_hash=hashlib.sha256(password.encode()).hexdigest(), role="doktor", full_name=f"Dr. {first_name} {last_name}", department_id=departments[department_name].id, doctor_id=doctor.id))
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
            ("Uğur", "Yılmaz", "10000000002", "05550000002", "Erkek"),
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
            session.add(User(username="hasta", password_hash=hashlib.sha256("hasta123".encode()).hexdigest(), role="hasta", full_name="Kübra Yılmaz", patient_id=patients[0].id))
            session.commit()

        # Seed edilmiş diğer hastalar için de giriş hesabı oluştur.
        # Demo hesabı hasta/hasta123 korunur; yeni hesaplar hasta0002 biçimindedir.
        for patient in patients[1:]:
            linked_user = session.exec(select(User).where(User.patient_id == patient.id)).first()
            username = f"hasta{patient.id:04d}"
            if not linked_user and not session.exec(select(User).where(User.username == username)).first():
                temporary_password = f"HBYS{patient.tc_no[-4:]}"
                session.add(User(
                    username=username,
                    password_hash=hashlib.sha256(temporary_password.encode()).hexdigest(),
                    role="hasta",
                    full_name=f"{patient.first_name} {patient.last_name}",
                    patient_id=patient.id,
                ))
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

@app.get("/")
def read_root():
    return {"message": "HBYS Backend Sistemine Hoş Geldiniz:)"}


@app.post("/auth/login", response_model=LoginResponse)
def login(credentials: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(
        select(User).where(User.username == credentials.username.strip())
    ).first()
    password_hash = hashlib.sha256(credentials.password.encode()).hexdigest()

    if not user or user.password_hash != password_hash:
        raise HTTPException(status_code=401, detail="Kullanıcı adı veya şifre hatalı.")

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
    if user.password_hash != hashlib.sha256(request.current_password.encode()).hexdigest():
        raise HTTPException(status_code=401, detail="Mevcut şifre hatalı.")
    if len(request.new_password) < 8:
        raise HTTPException(status_code=422, detail="Yeni şifre en az 8 karakter olmalıdır.")
    if request.current_password == request.new_password:
        raise HTTPException(status_code=422, detail="Yeni şifre mevcut şifreden farklı olmalıdır.")
    user.password_hash = hashlib.sha256(request.new_password.encode()).hexdigest()
    session.add(user)
    session.commit()
    session.add(AuditLog(user_id=user.id, action="SIFRE_DEGISTIRILDI", entity_type="User", entity_id=user.id))
    session.commit()
    return {"message": "Şifreniz başarıyla değiştirildi."}

# 👤 --- Hasta (Patient) Endpointleri ---
@app.post("/patients/", response_model=PatientCreateResponse)
def create_patient(patient: Patient, user_id: int | None = None, session: Session = Depends(get_session)):
    if session.exec(select(Patient).where(Patient.tc_no == patient.tc_no)).first():
        raise HTTPException(status_code=409, detail="Bu TC kimlik numarasıyla kayıtlı bir hasta zaten var.")

    session.add(patient)
    session.commit()
    session.refresh(patient)

    username = f"hasta{patient.id:04d}"
    temporary_password = f"HBYS{patient.tc_no[-4:]}"
    session.add(User(
        username=username,
        password_hash=hashlib.sha256(temporary_password.encode()).hexdigest(),
        role="hasta",
        full_name=f"{patient.first_name} {patient.last_name}",
        patient_id=patient.id,
    ))
    session.commit()
    session.add(AuditLog(user_id=user_id, action="HASTA_OLUSTURULDU", entity_type="Patient", entity_id=patient.id, details=f"{patient.first_name} {patient.last_name}"))
    session.commit()
    return PatientCreateResponse(
        patient=patient,
        username=username,
        temporary_password=temporary_password,
    )

@app.get("/patients/", response_model=list[Patient])
def get_patients(patient_id: int | None = None, session: Session = Depends(get_session)):
    query = select(Patient)
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

# 📅 --- Randevu (Appointment) Endpointleri ---
@app.post("/appointments/", response_model=Appointment)
def create_appointment(appointment: Appointment, session: Session = Depends(get_session)):
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

    # İptal edilmiş randevular aynı saate yeniden randevu alınmasına engel olmaz.
    doctor_conflict = session.exec(
        select(Appointment).where(
            Appointment.doctor_id == appointment.doctor_id,
            Appointment.appointment_date == appointment.appointment_date,
            Appointment.status != "İptal Edildi",
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
            Appointment.status != "İptal Edildi",
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


@app.put("/appointments/{appointment_id}/cancel", response_model=Appointment)
def cancel_appointment(appointment_id: int, user_id: int | None = None, session: Session = Depends(get_session)):
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")
    if appointment.status == "Tamamlandı":
        raise HTTPException(status_code=409, detail="Tamamlanmış randevu iptal edilemez.")
    appointment.status = "İptal Edildi"
    session.add(appointment)
    session.commit()
    session.refresh(appointment)
    session.add(AuditLog(user_id=user_id, action="RANDEVU_IPTAL_EDILDI", entity_type="Appointment", entity_id=appointment.id))
    session.commit()
    return appointment

@app.patch("/appointments/{appointment_id}/status", response_model=Appointment)
def update_appointment_status(appointment_id: int, status: str, user_id: int | None = None, session: Session = Depends(get_session)):
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")

    allowed_statuses = {"Talep Edildi", "Onaylandı", "Reddedildi", "Bekliyor", "Muayenede", "Tamamlandı", "İptal Edildi", "Gelmedi"}
    if status not in allowed_statuses:
        raise HTTPException(status_code=422, detail="Geçersiz randevu durumu.")

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
    return appointment


@app.patch("/appointments/{appointment_id}/approve", response_model=Appointment)
def approve_appointment(appointment_id: int, user_id: int, session: Session = Depends(get_session)):
    return change_requested_appointment(appointment_id, user_id, "Onaylandı", session)


@app.patch("/appointments/{appointment_id}/reject", response_model=Appointment)
def reject_appointment(appointment_id: int, user_id: int, session: Session = Depends(get_session)):
    return change_requested_appointment(appointment_id, user_id, "Reddedildi", session)


@app.get("/audit-logs/", response_model=list[AuditLog])
def get_audit_logs(session: Session = Depends(get_session)):
    return session.exec(select(AuditLog).order_by(AuditLog.created_at.desc())).all()

# 📋 --- Muayene Kaydı (Medical Record) Endpointleri ---
@app.post("/medical-records/", response_model=MedicalRecord)
def create_medical_record(record: MedicalRecord, user_id: int | None = None, session: Session = Depends(get_session)):
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

# 💊 --- Reçete (Prescription) Endpointleri ---
@app.post("/prescriptions/", response_model=Prescription)
def create_prescription(prescription: Prescription, user_id: int | None = None, session: Session = Depends(get_session)):
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
