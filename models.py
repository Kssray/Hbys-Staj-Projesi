from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


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
    appointment_date: datetime                         # Randevu tarihi ve saati
    status: str = Field(default="Talep Edildi")         # Talep Edildi, Onaylandı, Bekliyor, Muayenede, Tamamlandı, İptal Edildi, Gelmedi
    request_note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    requested_by_user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    confirmed_by_user_id: Optional[int] = Field(default=None, foreign_key="user.id")



# 1. MUAYENE / TIBBİ KAYIT MODELİ
class MedicalRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    appointment_id: int = Field(foreign_key="appointment.id", unique=True)
    diagnosis: str  # Teşhis (Örn: "Akut Faranjit")
    notes: Optional[str] = None  # Doktorun muayene notları
    created_at:Optional[datetime] = Field(default_factory=datetime.utcnow)

# 2. REÇETE MODELİ
class Prescription(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    medical_record_id: int = Field(foreign_key="medicalrecord.id")
    medicine_name: str  # İlaç adı (Örn: "Parol 500mg")
    dosage: str  # Kullanım şekli (Örn: "Günde 2x1 tok karnına")
    days: int = 5  # Kaç günlük tedavi


class AuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    details: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
