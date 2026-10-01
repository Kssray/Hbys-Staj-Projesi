from sqlalchemy import event
from sqlmodel import Session, create_engine


DATABASE_URL = "sqlite:///./hbys.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
    """SQLite bağlantılarında foreign key kurallarını gerçekten etkinleştirir."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def get_session():
    """Her API isteği için güvenli biçimde açılıp kapanan veritabanı oturumu."""
    with Session(engine) as session:
        yield session
