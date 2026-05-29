import uuid
from typing import Optional

from pydantic import BaseModel

from app.models.enums import UserRole


class Token(BaseModel):
    # Raspunsul standard OAuth2 dupa /auth/login.
    # token_type=bearer e fixat pentru ca asa cere RFC 6750 (header Authorization: Bearer <token>).
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    # Continutul decodat al JWT-ului.
    # sub (subject) = ID-ul userului (standard JWT).
    sub: uuid.UUID
    role: UserRole
    exp: Optional[int] = None  # Unix timestamp expirare; setat la creare
