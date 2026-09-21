from sqlmodel import create_engine, Session

# SQLite bağlantı cümlesi: Proje klasörünün içinde otomatik 'hbys.db' adında bir dosya oluşturur.
DATABASE_URL = "sqlite:///hbys.db"

# engine, Python ile veritabanı dosyamız arasında köprü kurar.
# 'check_same_thread': False parametresi, FastAPI'nin asenkron yapısıyla SQLite'ın çakışmasını önler.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=True)

def get_session():
    with Session(engine) as session:
        yield session