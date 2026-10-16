# 🏥 Hastane Bilgi Yönetim Sistemi (HBYS)

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)

Çanakkale Onsekiz Mart Üniversitesi (ÇOMÜ) Bilgisayar Mühendisliği Bölümü zorunlu staj programı kapsamında, Çanakkale Mehmet Akif Ersoy Devlet Hastanesi Bilgi İşlem Biriminde geliştirilen **Full-Stack Hastane Bilgi Yönetim Sistemi (HBYS)** prototipidir.

Bu proje, hastanelerdeki manuel kayıt süreçlerinin yarattığı veri kirliliğini önlemek, poliklinik-servis-yatak yönetimi arasındaki koordinasyonu sağlamak ve klinik iş akışlarını dijitalleştirerek sağlık personelinin iş yükünü optimize etmek amacıyla tasarlanmıştır.

##  Sistem Mimarisi (3-Tier Architecture)

Proje, ölçeklenebilirlik ve sürdürülebilirlik prensiplerine uygun olarak 3 katmanlı (3-Tier) modern bir web mimarisi üzerine inşa edilmiştir:

1.  **Sunum Katmanı (Frontend):** Kullanıcı deneyimi odaklı, sekmeli navigasyon yapısına sahip dinamik arayüz. (React, Vite, Tailwind CSS)
2.  **Mantıksal Katman (Backend):** Asenkron RESTful API yönetimi, iş akışları ve yetkilendirme servisleri. (Python, FastAPI, Pydantic)
3.  **Veri Katmanı (Database):** Nesne yönelimli veritabanı tasarımı (ORM) ve kalıcı veri depolama. (SQLModel, SQLite, Migrations)

## Temel Özellikler ve Modüller

### 1. Rol Bazlı Yetkilendirme (RBAC) ve Güvenlik
Sistem, kullanıcı rollerine göre sıkı bir erişim kontrolü (Role-Based Access Control) uygular:
*   **Yönetici:** Tüm sistem ayarları, audit loglar, poliklinik ve kullanıcı yönetimi.
*   **Doktor:** Randevu listesi, hasta muayene ekranı, reçete yazma ve tıbbi geçmiş (Yalnızca kendi branşı).
*   **Sekreter:** Hasta kaydı, randevu oluşturma/iptal, takvim yönetimi (Poliklinik bazlı).
*   **Hemşire:** Servis ve yatak yönetimi, hasta yatışı, taburcu ve transfer işlemleri (Yetkili servis).
*   **Temizlik Personeli:** Yatak temizlik görevleri takibi, görev başlatma ve tamamlama (Tıbbi veriye kapalı).
*   **Hasta:** Kendi randevu taleplerini oluşturma, reçetelerini görüntüleme (Yalnızca kendi verisi).
*   *Güvenlik:* Kullanıcı parolaları PBKDF2 (SHA-256) algoritması ve tuzlama (salt) yöntemiyle güvenli depolanır. Kritik veri değişiklikleri **Audit Log** ile kayıt altına alınır.

### 2. Akıllı Randevu Yönetimi ve Klinik Süreçler
*   Poliklinik bazlı doktor sugerasyonu, en yakın tarih filtresi ve çakışma kontrolü.
*   Doktor panelinde tek tıkla muayene başlatma, teşhis ve tedavi (Medical Record & Prescription) girişi.
*   **Otomatik SMS Bildirimi:** Onaylanan randevular için arka planda asenkron kuyruk (Uvicorn Worker) ile planlanan 24 Saat / 2 Saat hatırlatma SMS simülasyonu.

### 3. Yatan Hasta Süreç Yönetimi (Servis, Yatak ve Hemşire İş Akışı)
Yatak durumları (Boş/Dolu/Temizlikte) backend tarafında atomik işlemlerle (State Machine) yönetilir:
*   **Hasta Yatışı:** Servis yetkisi ve izolasyon tipi (Damlacık, Temas, Solunum) uyumluluk kontrolü ile boş yatağa atama.
*   **Transfer:** Yatan hastanın mevcut kaydının kapatılması ve yeni yatağa taşınması.
*   **Taburcu:** Yatışın sonlandırılması ve yatağın otomatik "Temizlikte" statüsüne alınması.
*   **Temizlik:** Temizlik personeline görev atanması ve işlem bitiminde yatağın yeniden "Boş" olması.

### 4. Temizlik Personeli ve Akıllı Operasyon Merkezi
*   Taburcu sonrası oluşan yatak temizlik taleplerinin "Bekliyor", "Başladı" ve "Tamamlandı" fazlarıyla görev bazlı takibi.
*   Yönetici panelinde hastane geneli ve poliklinik bazlı doluluk oranlarının gerçek zamanlı dashboard tasarımı ile görselleştirilmesi.

##  Veri Modeli ve Klinik Varlıklar (Entity-Relationship)

SQLModel tabanlı ilişkisel veritabanı şeması şu ana varlıkları içerir:
*   `Patient`, `Doctor`, `Department`
*   `Appointment`, `MedicalRecord`, `Prescription`
*   `InpatientService`, `Room`, `Bed`, `BedAssignment`
*   `CleaningTask` (Taburcu ve transfer işlemlerinde tetiklenir)

Markdown
##  Kurulum ve Çalıştırma

Projeyi lokal ortamınızda çalıştırmak için aşağıdaki adımları izleyebilirsiniz. Bilgisayarınızda **Python 3.8+** ve **Node.js** yüklü olduğundan emin olun.

### 1. Projeyi Klonlayın
```bash
git clone [https://github.com/Kssray/Hbys-Staj-Projesi.git](https://github.com/Kssray/Hbys-Staj-Projesi.git)
cd Hbys-Staj-Projesi
2. Backend (FastAPI) Kurulumu
Yeni bir terminal açın ve proje ana dizininde (veya backend klasöründe) şu komutları çalıştırın:

Bash
# Sanal ortam (virtual environment) oluşturun
python -m venv venv

# Sanal ortamı aktifleştirin
# Windows için:
venv\Scripts\activate
# macOS/Linux için:
source venv/bin/activate

# Gerekli bağımlılıkları yükleyin
pip install -r requirements.txt

# FastAPI sunucusunu başlatın
uvicorn main:app --reload
Backend sunucusu http://127.0.0.1:8000 adresinde çalışmaya başlayacaktır. API dokümantasyonuna ve test arayüzüne (Swagger UI) http://127.0.0.1:8000/docs adresinden ulaşabilirsiniz.

3. Frontend (React/Vite) Kurulumu
Yeni bir terminal sekmesi açın ve frontend klasörüne gidin:

Bash
cd frontend

# Node modüllerini ve paketleri yükleyin
npm install

# Vite geliştirici sunucusunu başlatın
npm run dev
Frontend uygulaması http://localhost:5173 adresinde çalışmaya başlayacaktır.

Bu proje, Çanakkale Onsekiz Mart Üniversitesi Bilgisayar Mühendisliği Bölümü Staj programı kapsamında Kübra Yılmaz tarafından geliştirilmiştir.
