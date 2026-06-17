import uuid
from datetime import datetime, time
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict, model_validator

from app.models.enums import SportType, SurfaceType


# ── Pricing Rules ──────────────────────────────────────────────────────────────
class PricingRuleBase(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=luni, 6=duminica")
    start_time: time
    end_time: time
    price_per_hour: Decimal = Field(..., gt=0, decimal_places=2)
    currency: str = Field("RON", min_length=3, max_length=3)

    @model_validator(mode="after")
    def check_time_order(self) -> "PricingRuleBase":
        # end_time == 00:00 inseamna "miezul noptii / 24:00" -> program pana la finalul
        # zilei (permite intervale care se intind pana la / peste miezul noptii).
        if self.end_time != time(0, 0) and self.start_time >= self.end_time:
            raise ValueError("start_time trebuie sa fie inainte de end_time (sau end_time = 00:00 pentru miezul noptii)")
        return self


class PricingRuleCreate(PricingRuleBase):
    pass


class PricingRuleOut(PricingRuleBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    field_id: uuid.UUID


# ── Fields ─────────────────────────────────────────────────────────────────────
class FieldBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    sport_type: SportType
    # Recomandare de format aleasa liber de admin (optionala, doar informativa).
    recommended_format: Optional[str] = Field(None, max_length=60)
    surface_type: SurfaceType
    is_indoor: bool = False

    # Constrangerea pe DB e doar > 0; aici punem si o limita superioara
    # rezonabila (24h) ca sa prindem erori de input mai devreme.
    min_booking_minutes: int = Field(60, ge=15, le=1440)
    slot_duration_minutes: int = Field(30, ge=15, le=240)

    is_active: bool = True

    @model_validator(mode="after")
    def check_slot_divides_min_booking(self) -> "FieldBase":
        # Regula de business: durata minima trebuie sa fie multiplu al slotului.
        # Altfel ai sloturi care nu pot fi "completate" intr-o rezervare valida.
        if self.min_booking_minutes % self.slot_duration_minutes != 0:
            raise ValueError(
                "min_booking_minutes trebuie sa fie multiplu al slot_duration_minutes"
            )
        return self


class FieldCreate(FieldBase):
    pass


class FieldUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    sport_type: Optional[SportType] = None
    recommended_format: Optional[str] = Field(None, max_length=60)
    surface_type: Optional[SurfaceType] = None
    is_indoor: Optional[bool] = None
    min_booking_minutes: Optional[int] = Field(None, ge=15, le=1440)
    slot_duration_minutes: Optional[int] = Field(None, ge=15, le=240)
    is_active: Optional[bool] = None


class FieldOut(FieldBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    venue_id: uuid.UUID
    created_at: datetime
