import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, ConfigDict

from app.models.enums import UserRole


class UserBase(BaseModel):
    # EmailStr valideaza formatul "ceva@domeniu.tld" la parse-time.
    # Daca clientul trimite "abc", FastAPI returneaza 422 cu mesaj clar.
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=150)
    phone: Optional[str] = Field(None, max_length=20)


class UserCreate(UserBase):
    # min_length=8 e regula minima rezonabila pentru o licenta.
    # In productie ai mai vrea: complexitate, lista neagra etc.
    password: str = Field(..., min_length=8, max_length=128)


class UserUpdate(BaseModel):
    # Toate optional — userul poate actualiza doar ce vrea.
    # full_name=None inseamna "nu schimba", NU "sterge".
    full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    phone: Optional[str] = Field(None, max_length=20)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(UserBase):
    # model_config inlocuieste vechiul "class Config" din Pydantic v1.
    # from_attributes=True = Pydantic poate construi schema dintr-un obiect ORM
    # (citeste atributele direct: user.email, nu user["email"]).
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: UserRole
    email_verified: bool
    is_active: bool
    created_at: datetime

    # Atentie: NU expunem password_hash, oauth_id, oauth_provider catre client.
    # Daca nu sunt declarate aici, Pydantic le ignora la serializare.
