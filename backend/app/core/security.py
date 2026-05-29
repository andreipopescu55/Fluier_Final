"""
Functii utilitare pentru securitate: hashing parole + JWT.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings
from app.models.enums import UserRole


# CryptContext gestioneaza schemele de hash.
# "bcrypt" e standardul; "deprecated=auto" reseteaza vechiul hash daca schimbi schema in viitor.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Hash o parola clara. Apelat la register / change-password."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verifica o parola fata de un hash. Apelat la login."""
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(
    user_id: uuid.UUID,
    role: UserRole,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Genereaza un JWT semnat care contine (sub=user_id, role, exp).
    Clientul il trimite inapoi in header: "Authorization: Bearer <token>".
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    # Folosim UTC consistent. JWT exp e Unix timestamp (secunde).
    expire = datetime.now(timezone.utc) + expires_delta

    payload = {
        "sub": str(user_id),       # JWT cere sub sa fie string
        "role": role.value,        # enum -> string ("client", "venue_admin", ...)
        "exp": expire,             # jose converteste automat datetime -> timestamp
    }

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decodeaza si valideaza un JWT.
    Arunca JWTError daca tokenul e invalid sau expirat — endpointul prinde si returneaza 401.
    """
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


# Re-export pentru ca importurile din endpointuri sa fie simple
__all__ = [
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_access_token",
    "JWTError",
]
