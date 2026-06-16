import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict, model_validator

from app.models.enums import BookingStatus, BookingSource


class BookingCreate(BaseModel):
    field_id: uuid.UUID
    start_time: datetime
    end_time: datetime

    # Optional pentru ca BOTH "rezervare online" (user_id setat in cod din JWT)
    # si "rezervare manuala admin" (customer_name + customer_phone) sunt valide.
    customer_name: Optional[str] = Field(None, max_length=150)
    customer_phone: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def check_time_order(self) -> "BookingCreate":
        if self.start_time >= self.end_time:
            raise ValueError("start_time trebuie sa fie inainte de end_time")
        # Aici NU verificam ca start_time > now() — admin-ul poate marca o
        # rezervare in trecut (manual). Verificarea aceea o facem in endpoint
        # doar pentru rezervarile online.
        return self


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    field_id: uuid.UUID
    user_id: Optional[uuid.UUID]
    start_time: datetime
    end_time: datetime
    total_price: Decimal
    deposit_amount: Optional[Decimal] = None  # avans (50%); restul se achita la baza
    currency: str
    status: BookingStatus
    booking_source: BookingSource
    customer_name: Optional[str]
    customer_phone: Optional[str]
    notes: Optional[str]
    created_at: datetime


class BookingManualBlock(BaseModel):
    # Blocare manuala admin — fara user, fara pret (interval marcat ca indisponibil).
    # Folosit pentru: intretinere, eveniment privat, rezervare telefonica fara plata digitala etc.
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = Field(None, description="Motivul blocarii: 'intretinere', 'eveniment privat' etc.")

    @model_validator(mode="after")
    def check_time_order(self) -> "BookingManualBlock":
        if self.start_time >= self.end_time:
            raise ValueError("start_time trebuie sa fie inainte de end_time")
        return self


# ── Calendar (format FullCalendar) ──────────────────────────────────────────────
class CalendarEventProps(BaseModel):
    # extendedProps — campuri proprii pe care le citeste frontend-ul (ex: la click pe eveniment).
    status: BookingStatus
    source: BookingSource
    total_price: Decimal
    currency: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    notes: Optional[str] = None


class CalendarEvent(BaseModel):
    """Un eveniment in formatul asteptat de biblioteca FullCalendar."""
    id: uuid.UUID
    title: str
    start: datetime
    end: datetime
    color: str  # culoare in functie de status (pending/confirmed/blocat)
    extendedProps: CalendarEventProps
