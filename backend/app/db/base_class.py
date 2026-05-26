from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    # DeclarativeBase este clasa moderna din SQLAlchemy 2.0
    # Orice model care mosteneste din Base devine automat un tabel in DB
    # Exemplu: class User(Base) -> tabelul "users" in PostgreSQL
    pass
