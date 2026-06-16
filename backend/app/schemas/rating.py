import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RatingCreate(BaseModel):
    score: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)


class RatingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    venue_id: uuid.UUID
    user_id: uuid.UUID
    score: int
    comment: Optional[str]
    created_at: datetime


class RatingSummary(BaseModel):
    """Sumar afisat clientilor: media, numarul de evaluari, scorul meu si dreptul de a evalua."""
    average: Optional[float] = None  # None daca nu exista evaluari
    count: int = 0
    my_score: Optional[int] = None   # scorul userului curent, daca e autentificat si a votat
    can_rate: bool = False           # True daca userul a jucat aici (rezervare trecuta)
