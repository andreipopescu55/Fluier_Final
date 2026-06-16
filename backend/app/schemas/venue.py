import uuid
import re
from datetime import datetime, time
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator

from app.models.enums import VenueStatus


SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class VenueBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    address: str = Field(..., min_length=5, max_length=300)
    city: str = Field(..., min_length=2, max_length=100)
    county: str = Field(..., min_length=2, max_length=100)
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180)
    phone: Optional[str] = Field(None, max_length=20)
    opening_time: time
    closing_time: time

    @model_validator(mode="after")
    def check_hours(self) -> "VenueBase":
        # Validare cross-field: ora deschidere < ora inchidere.
        # Asta NU acopera baze "non-stop" (24h) — daca vrei, schimbi regula.
        if self.opening_time >= self.closing_time:
            raise ValueError("opening_time trebuie sa fie inainte de closing_time")
        return self


class VenueCreate(VenueBase):
    # Slug-ul e generat de client (sau auto pe server din nume).
    # Aici il acceptam optional — daca lipseste, il generam in CRUD.
    slug: Optional[str] = Field(None, min_length=2, max_length=220)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not SLUG_RE.match(v):
            raise ValueError("slug trebuie sa fie de forma 'litere-cifre-cratima' (lowercase)")
        return v


class VenueUpdate(BaseModel):
    # Toate optional — PATCH-style.
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = None
    address: Optional[str] = Field(None, min_length=5, max_length=300)
    city: Optional[str] = Field(None, min_length=2, max_length=100)
    county: Optional[str] = Field(None, min_length=2, max_length=100)
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180)
    phone: Optional[str] = Field(None, max_length=20)
    opening_time: Optional[time] = None
    closing_time: Optional[time] = None


class VenueStatusUpdate(BaseModel):
    # Folosit DOAR de super_admin pentru moderare (aprobare/suspendare).
    status: VenueStatus


class VenueOut(VenueBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID
    slug: str
    status: VenueStatus
    created_at: datetime

    # Rating agregat (completat de endpoint).
    rating_avg: Optional[float] = None
    rating_count: int = 0


class VenueListItem(BaseModel):
    # Versiune mai slaba pentru listare publica — exclude detalii sensibile/voluminoase.
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    city: str
    county: str
    status: VenueStatus

    # Rating agregat (completat de endpoint).
    rating_avg: Optional[float] = None
    rating_count: int = 0
