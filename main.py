from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Session, select
from database import engine, get_session
from models import Patient, Department, Doctor, Appointment, MedicalRecord, Prescription

app = FastAPI(title="HBYS Staj Projesi", version="1.0")

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
    
    with Session(engine) as session:
        existing_department = session.exec(select(Department)).first()
        if not existing_department:
            dep_dahiliye = Department(name="Dahiliye")
            dep_goz = Department(name="Göz Hastalıkları")
            session.add(dep_dahiliye)
            session.add(dep_goz)
            session.commit()
            
            doc1 = Doctor(first_name="Ahmet", last_name="Yılmaz", department_id=1)
            doc2 = Doctor(first_name="Ayşe", last_name="Demir", department_id=2)
            session.add(doc1)
            session.add(doc2)
            session.commit()

@app.get("/")
def read_root():
    return {"message": "HBYS Backend Sistemine Hoş Geldiniz:)"}

# 👤 --- Hasta (Patient) Endpointleri ---
@app.post("/patients/", response_model=Patient)
def create_patient(patient: Patient, session: Session = Depends(get_session)):
    session.add(patient)
    session.commit()
    session.refresh(patient)
    return patient

@app.get("/patients/", response_model=list[Patient])
def get_patients(session: Session = Depends(get_session)):
    return session.exec(select(Patient)).all()

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
    if isinstance(appointment.appointment_date, str):
        appointment.appointment_date = datetime.fromisoformat(appointment.appointment_date)
    
    session.add(appointment)
    session.commit()
    session.refresh(appointment)
    return appointment

@app.get("/appointments/", response_model=list[Appointment])
def get_appointments(doctor_id: int | None = None, session: Session = Depends(get_session)):
    query = select(Appointment)
    if doctor_id:
        query = query.where(Appointment.doctor_id == doctor_id)
    return session.exec(query).all()

@app.get("/appointments/{appointment_id}", response_model=Appointment)
def get_appointment(appointment_id: int, session: Session = Depends(get_session)):
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")
    return appointment

@app.patch("/appointments/{appointment_id}/status", response_model=Appointment)
def update_appointment_status(appointment_id: int, status: str, session: Session = Depends(get_session)):
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Randevu bulunamadı")
    
    appointment.status = status
    session.add(appointment)
    session.commit()
    session.refresh(appointment)
    return appointment

# 📋 --- Muayene Kaydı (Medical Record) Endpointleri ---
@app.post("/medical-records/", response_model=MedicalRecord)
def create_medical_record(record: MedicalRecord, session: Session = Depends(get_session)):
    session.add(record)
    session.commit()
    session.refresh(record)
    return record

@app.get("/medical-records/", response_model=list[MedicalRecord])
def get_medical_records(session: Session = Depends(get_session)):
    return session.exec(select(MedicalRecord)).all()

# 💊 --- Reçete (Prescription) Endpointleri ---
@app.post("/prescriptions/", response_model=Prescription)
def create_prescription(prescription: Prescription, session: Session = Depends(get_session)):
    session.add(prescription)
    session.commit()
    session.refresh(prescription)
    return prescription

@app.get("/prescriptions/", response_model=list[Prescription])
def get_prescriptions(session: Session = Depends(get_session)):
    return session.exec(select(Prescription)).all()

@app.get("/medical-records/{record_id}/prescriptions", response_model=list[Prescription])
def get_prescriptions_by_record(record_id: int, session: Session = Depends(get_session)):
    query = select(Prescription).where(Prescription.medical_record_id == record_id)
    return session.exec(query).all()