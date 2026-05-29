from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


# Radacina proiectului = parintele lui backend/.
# Calculam absolut pentru ca settings sa gaseasca .env indiferent
# din ce folder rulezi (alembic din backend/, uvicorn din root, pytest din tests/).
PROJECT_ROOT = Path(__file__).resolve().parents[3]
ENV_FILE = PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        # Ignora variabile din .env care nu sunt declarate aici (POSTGRES_USER etc.)
        extra="ignore",
    )

    APP_NAME: str = "Rezervari Terenuri"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # Format: postgresql+psycopg://user:password@host:port/dbname
    # "postgresql+psycopg" ii spune SQLAlchemy sa foloseasca driverul psycopg 3.
    # Default-ul de mai jos NU trebuie folosit in productie — vine din .env.
    DATABASE_URL: str = "postgresql+psycopg://user:password@localhost:5432/rezervari"

    REDIS_URL: str = "redis://localhost:6379"

    # JWT pentru autentificare. Numele in .env: JWT_SECRET_KEY.
    JWT_SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h


# Instantiem un singur obiect folosit peste tot in aplicatie.
# In loc sa citim .env de fiecare data, il citim o singura data la pornire.
settings = Settings()
