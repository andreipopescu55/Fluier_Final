from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    APP_NAME: str = "Rezervari Terenuri"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # Format: postgresql+psycopg://user:password@host:port/dbname
    # "postgresql+psycopg" ii spune SQLAlchemy sa foloseasca driverul psycopg 3
    DATABASE_URL: str = "postgresql+psycopg://user:password@localhost:5432/rezervari"

    REDIS_URL: str = "redis://localhost:6379"

    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30


# Instantiem un singur obiect folosit peste tot in aplicatie
# In loc sa citim .env de fiecare data, il citim o singura data la pornire
settings = Settings()
