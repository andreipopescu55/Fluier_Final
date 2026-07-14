import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import MatchStatus, MatchSkillLevel, ParticipantStatus


class MatchCreate(BaseModel):
    booking_id: uuid.UUID
    total_spots: int = Field(..., ge=2, le=30, description="Numarul total de jucatori (ex: 10 = 5v5)")
    skill_level: MatchSkillLevel = MatchSkillLevel.ANY
    note: Optional[str] = Field(None, max_length=500)
    price_per_player: Optional[Decimal] = Field(None, ge=0, description="Cost informativ per jucator")


class ParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    full_name: str
    status: ParticipantStatus
    created_at: datetime


class MatchListItem(BaseModel):
    """Card de meci in lista publica + stare pentru userul curent."""
    id: uuid.UUID
    booking_id: uuid.UUID
    status: MatchStatus
    skill_level: MatchSkillLevel
    total_spots: int
    spots_taken: int          # aprobati + organizator
    spots_left: int
    note: Optional[str] = None
    price_per_player: Optional[Decimal] = None

    # Context din rezervare / baza / teren
    start_time: datetime
    end_time: datetime
    venue_name: str
    venue_slug: str
    city: str
    field_name: str
    sport_type: str
    organizer_name: str

    # Context pentru userul curent (gol daca nu e autentificat)
    is_organizer: bool = False
    my_status: Optional[ParticipantStatus] = None


class MatchDetail(MatchListItem):
    organizer_id: uuid.UUID
    field_id: uuid.UUID
    participants: List[ParticipantOut] = []      # roster aprobat (vizibil tuturor)
    pending_requests: List[ParticipantOut] = []  # cereri in asteptare (doar pentru organizator)


# ── Chat de meci ────────────────────────────────────────────────────────────────
class MatchMessageCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=500)


class MatchMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: Optional[uuid.UUID]     # None = mesaj de sistem
    author_name: str                 # "Sistem" pentru mesajele automate
    is_system: bool
    body: str
    created_at: datetime
