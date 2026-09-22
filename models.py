from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


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
    status: str = Field(default="Bekliyor")            # Durum: Bekliyor, Tamamlandı, İptal    



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