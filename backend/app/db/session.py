from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Engine-ul gestioneaza pool-ul de conexiuni catre PostgreSQL.
# pool_pre_ping=True verifica daca conexiunea e inca vie inainte sa o foloseasca.
# Util pentru a evita erori dupa perioade de inactivitate.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)

# SessionLocal este o clasa (fabrica).
# De fiecare data cand apelezi SessionLocal() obtii o sesiune noua.
# autocommit=False: modificarile nu se salveaza automat, trebuie sa apelezi explicit commit()
# autoflush=False: SQLAlchemy nu trimite automat SQL-ul catre DB inainte de query-uri
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)
