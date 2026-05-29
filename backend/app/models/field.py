import uuid
from datetime import datetime, time
from decimal import Decimal
from typing import List

from sqlalchemy import (
    String, Boolean, Integer, Numeric, Time,
    CheckConstraint, Enum as SAEnum, text, ForeignKey, Uuid,
)
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import SportType, SurfaceType


class Field(Base):
    __tablename__ = "fields"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)

    venue_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("venues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)

    sport_type: Mapped[SportType] = mapped_column(
        SAEnum(SportType, name="sport_type", create_type=False, values_callable=lambda e: [v.value for v in e]),
        nullable=False,
        index=True,
    )

    surface_type: Mapped[SurfaceType] = mapped_column(
        SAEnum(SurfaceType, name="surface_type", create_type=False, values_callable=lambda e: [v.value for v in e]),
        nullable=False,
        index=True,
    )

    is_indoor: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))

    # Durata minima rezervabila (ex: 60 minute = minim 1 ora)
    min_booking_minutes: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("60"))

    # Granularitatea sloturilor (ex: 30 min = rezervari incep la :00 sau :30)
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("30"))

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"), index=True)

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )

    __table_args__ = (
        # PostgreSQL valideaza aceste conditii la orice INSERT sau UPDATE
        CheckConstraint("min_booking_minutes > 0", name="chk_min_booking_positive"),
        CheckConstraint("slot_duration_minutes > 0", name="chk_slot_duration_positive"),
    )

    # Relationships
    venue: Mapped["Venue"] = relationship("Venue", back_populates="fields")
    pricing_rules: Mapped[List["PricingRule"]] = relationship(
        "PricingRule", back_populates="field", cascade="all, delete-orphan"
    )
    bookings: Mapped[List["Booking"]] = relationship("Booking", back_populates="field")


class PricingRule(Base):
    __tablename__ = "pricing_rules"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)

    field_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("fields.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 0 = luni, 6 = duminica (standard ISO)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    # DECIMAL(10,2) = maxim 99999999.99, 2 zecimale (suficient pentru preturi RON)
    price_per_hour: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default=text("'RON'"))

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )

    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="chk_day_of_week"),
        CheckConstraint("end_time > start_time", name="chk_time_range"),
        CheckConstraint("price_per_hour > 0", name="chk_price_positive"),
    )

    # Relationships
    field: Mapped["Field"] = relationship("Field", back_populates="pricing_rules")
