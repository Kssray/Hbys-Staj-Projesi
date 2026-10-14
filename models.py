from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, DateTime


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True, max_length=80)
    password_hash: str
    role: str = Field(default="sekreter")
    full_name: str
    department_id: Optional[int] = Field(default=None, foreign_key="department.id")
    doctor_id: Optional[int] = Field(default=None, foreign_key="doctor.id")
    patient_id: Optional[int] = Field(default=None, foreign_key="patient.id")


# 1. HASTA MODELİ
class Patient(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tc_no: str = Field(index=True, unique=True, max_length=11)
    first_name: str
    last_name: str
    phone: Optional[str] = None
    gender: str

# 2. POLİKLİNİK (BÖLÜM) MODELİ
class Department(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    description: Optional[str] = None

# 3. DOKTOR MODELİ
class Doctor(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    first_name: str
    last_name: str
    department_id: Optional[int] = Field(default=None, foreign_key="department.id")
    phone : Optional[str] = None

class Appointment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    patient_id: int = Field(foreign_key="patient.id")  # Hangi hasta?
    doctor_id: int = Field(foreign_key="doctor.id")    # Hangi doktor?
    department_id: int = Field(foreign_key="department.id") # Hangi poliklinik?
    appointment_date: datetime = Field(sa_column=Column(DateTime))                         # Randevu tarihi ve saati
    status: str = Field(default="Talep Edildi")         # Talep Edildi, Onaylandı, Bekliyor, Muayenede, Tamamlandı, İptal Edildi, Gelmedi
    request_note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime))
    requested_by_user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    confirmed_by_user_id: Optional[int] = Field(default=None, foreign_key="user.id")



# 1. MUAYENE / TIBBİ KAYIT MODELİ
class MedicalRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    appointment_id: int = Field(foreign_key="appointment.id", unique=True)
    diagnosis: str  # Teşhis (Örn: "Akut Faranjit")
    notes: Optional[str] = None  # Doktorun muayene notları
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime))

# 2. REÇETE MODELİ
class Prescription(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    medical_record_id: int = Field(foreign_key="medicalrecord.id")
    medicine_name: str  # İlaç adı (Örn: "Parol 500mg")
    dosage: str  # Kullanım şekli (Örn: "Günde 2x1 tok karnına")
    days: int = 5  # Kaç günlük tedavi
    prescription_number: Optional[str] = Field(default=None, unique=True, index=True)
    barcode: Optional[str] = Field(default=None, unique=True, index=True)


class AuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    details: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime))


class SMSReminder(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    appointment_id: int = Field(foreign_key="appointment.id", index=True)
    patient_id: int = Field(foreign_key="patient.id", index=True)
    phone: str
    reminder_type: str
    message: str
    scheduled_for: datetime = Field(sa_column=Column(DateTime))
    status: str = Field(default="Bekliyor")
    sent_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime))


# 8. YATAKLI SERVİS MODELİ
class InpatientService(SQLModel, table=True):
    """Hastanenin yatan hasta hizmeti veren servis birimi."""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    floor: Optional[str] = None
    specialty: Optional[str] = None
    total_beds: int = 0
    active: bool = True


# 9. ODA MODELİ
class Room(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    service_id: int = Field(foreign_key="inpatientservice.id", index=True)
    room_number: str
    room_type: str = "Standart"
    capacity: int = 1
    active: bool = True


# 10. YATAK MODELİ
class Bed(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    room_id: int = Field(foreign_key="room.id", index=True)
    bed_number: str
    status: str = "Boş"  # Boş, Dolu, Temizlikte, Bakıma Ayrıldı
    isolation_type: str = "Yok"  # Yok, Temas, Damlacık, Hava Yolu
    active: bool = True


# 11. HASTA YATIŞ / YATAK ATAMA MODELİ
class BedAssignment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    bed_id: int = Field(foreign_key="bed.id", index=True)
    patient_id: int = Field(foreign_key="patient.id", index=True)
    admission_reason: Optional[str] = None
    admitted_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime))
    discharged_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime))
    status: str = "Yatıyor"  # Yatıyor, Taburcu Edildi
    isolation_required: str = "Yok"
    transfer_from_assignment_id: Optional[int] = Field(default=None, foreign_key="bedassignment.id")


class BedHistory(SQLModel, table=True):
    """Hastanın hangi yatağa ne zaman alındığını ve ne zaman çıktığını tutar."""
    id: Optional[int] = Field(default=None, primary_key=True)
    bed_id: int = Field(foreign_key="bed.id", index=True)
    patient_id: int = Field(foreign_key="patient.id", index=True)
    assignment_id: Optional[int] = Field(default=None, foreign_key="bedassignment.id", index=True)
    admitted_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime))
    discharged_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime))


class CleaningTask(SQLModel, table=True):
    """Oda, bölüm veya yatak temizliğini takip eden görev kaydı."""
    id: Optional[int] = Field(default=None, primary_key=True)
    bed_id: int = Field(foreign_key="bed.id", index=True)
    service_id: int = Field(foreign_key="inpatientservice.id", index=True)
    location: Optional[str] = None
    task_type: str = "Yatak / Oda"
    status: str = "Bekliyor"  # Bekliyor, Devam Ediyor, Tamamlandı
    assigned_to_user_id: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime))
    started_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime))
