from datetime import datetime, timezone
from sqlmodel import Session, select

from database import engine
from models import Appointment, AuditLog, MedicalRecord, Prescription, User


DEMO_CASES = {
    5: {
        "diagnosis": "Akut bronşit",
        "notes": "Öksürük ve balgam şikâyeti değerlendirildi. Akciğer sesleri dinlendi; bol sıvı ve istirahat önerildi.",
        "medicine_name": "Broncho Syrup codex 100 ml",
        "dosage": "Günde 3 kez 1 ölçek, yemeklerden sonra",
        "days": 7,
    },
    7: {
        "diagnosis": "Mevsimsel alerjik rinit",
        "notes": "Burun tıkanıklığı ve hapşırma şikâyetleri değerlendirildi. Alerjenlerden uzak durması önerildi.",
        "medicine_name": "Alerfast 10 mg",
        "dosage": "Günde 1 kez, akşam",
        "days": 10,
    },
    8: {
        "diagnosis": "Demir eksikliği anemisi şüphesi",
        "notes": "Halsizlik ve baş dönmesi şikâyetleri değerlendirildi. Hemogram ve ferritin kontrolü önerildi.",
        "medicine_name": "Ferrosol 100 mg",
        "dosage": "Günde 1 kez, aç karnına",
        "days": 30,
    },
    9: {
        "diagnosis": "Akut gastroenterit",
        "notes": "Bulantı ve karın ağrısı şikâyetleri değerlendirildi. Sıvı kaybına karşı bol sıvı tüketmesi önerildi.",
        "medicine_name": "Oral Rehidratasyon Saşesi",
        "dosage": "Her dışkılama sonrası 1 saşe, suya karıştırılarak",
        "days": 3,
    },
}


def main():
    created_records = 0
    created_prescriptions = 0
    with Session(engine) as session:
        # "hasta" demo hesabı patient_id=4 olan Kübra Yılmaz'a bağlıdır.
        # Aynı isimli eski kayıtlardan bağımsız, bu hesaba görünür özel bir
        # tamamlanmış muayene örneği oluşturulur.
        kubra_demo_date = datetime(2026, 9, 26, 11, 0, tzinfo=timezone.utc)
        kubra_appointment = session.exec(
            select(Appointment).where(
                Appointment.patient_id == 4,
                Appointment.doctor_id == 1,
                Appointment.appointment_date == kubra_demo_date,
            )
        ).first()
        if not kubra_appointment:
            kubra_appointment = Appointment(
                patient_id=4,
                doctor_id=1,
                department_id=1,
                appointment_date=kubra_demo_date,
                status="Tamamlandı",
                created_at=datetime.now(timezone.utc),
            )
            session.add(kubra_appointment)
            session.commit()
            session.refresh(kubra_appointment)
        DEMO_CASES[kubra_appointment.id] = {
            "diagnosis": "Viral üst solunum yolu enfeksiyonu",
            "notes": "Boğaz ağrısı ve hafif ateş değerlendirildi. Sıvı tüketimi ve istirahat önerildi.",
            "medicine_name": "Parol 500 mg",
            "dosage": "Gerektiğinde 1 tablet, günde en fazla 3 kez",
            "days": 5,
        }

        for appointment_id, case in DEMO_CASES.items():
            appointment = session.get(Appointment, appointment_id)
            if not appointment:
                print(f"Atlandı: appointment_id={appointment_id} bulunamadı")
                continue

            record = session.exec(
                select(MedicalRecord).where(MedicalRecord.appointment_id == appointment_id)
            ).first()
            if not record:
                record = MedicalRecord(
                    appointment_id=appointment_id,
                    diagnosis=case["diagnosis"],
                    notes=case["notes"],
                    created_at=datetime.now(timezone.utc),
                )
                session.add(record)
                session.commit()
                session.refresh(record)
                created_records += 1

                doctor_user = session.exec(
                    select(User).where(
                        User.role == "doktor",
                        User.doctor_id == appointment.doctor_id,
                    )
                ).first()
                session.add(AuditLog(
                    user_id=doctor_user.id if doctor_user else None,
                    action="DEMO_MUAYENE_OLUSTURULDU",
                    entity_type="MedicalRecord",
                    entity_id=record.id,
                    details=f"Randevu: {appointment_id}",
                    created_at=datetime.now(timezone.utc),
                ))

            existing_prescription = session.exec(
                select(Prescription).where(Prescription.medical_record_id == record.id)
            ).first()
            if not existing_prescription:
                session.add(Prescription(
                    medical_record_id=record.id,
                    medicine_name=case["medicine_name"],
                    dosage=case["dosage"],
                    days=case["days"],
                ))
                created_prescriptions += 1

            if appointment.status not in {"İptal", "İptal Edildi", "Reddedildi", "Gelmedi"}:
                appointment.status = "Tamamlandı"
                session.add(appointment)

        session.commit()

    print(f"Yeni demo muayene: {created_records}")
    print(f"Yeni demo reçete: {created_prescriptions}")


if __name__ == "__main__":
    main()
