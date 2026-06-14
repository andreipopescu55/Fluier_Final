import uuid
from datetime import datetime, time
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import String, Text, Boolean, Integer, Numeric, Time, Enum as SAEnum, text, ForeignKey, Uuid
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import VenueStatus


class Venue(Base):
    __tablename__ = "venues"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ON DELETE RESTRICT = nu poti sterge un user care are baze sportive
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)

    # Slug = versiunea URL-friendly a numelui, ex: "fotbal-club-bucur" -> /venues/fotbal-club-bucur
    slug: Mapped[str] = mapped_column(String(220), unique=True, nullable=False, index=True)

    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    address: Mapped[str] = mapped_column(String(300), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    county: Mapped[str] = mapped_column(String(100), nullable=False)

    # Coordonate GPS pentru harta (pot lipsi)
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7), nullable=True)

    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Time = doar ora, fara data. Ex: 08:00, 22:00
    opening_time: Mapped[time] = mapped_column(Time, nullable=False)
    closing_time: Mapped[time] = mapped_column(Time, nullable=False)

    status: Mapped[VenueStatus] = mapped_column(
        SAEnum(VenueStatus, name="venue_status", create_type=False, values_callable=lambda e: [v.value for v in e]),
        nullable=False,
        server_default=text("'pending'"),
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )

    # Câmpuri tranzitorii (NU coloane) — completate de endpoint din agregatul de
    # rating si citite de Pydantic la serializare. Implicit: fara evaluari.
    rating_avg = None
    rating_count = 0

    # Relationships
    owner: Mapped["User"] = relationship(
        "User", back_populates="venues", foreign_keys=[owner_id]
    )
    images: Mapped[List["VenueImage"]] = relationship(
        "VenueImage", back_populates="venue", cascade="all, delete-orphan"
    )
    fields: Mapped[List["Field"]] = relationship(
        "Field", back_populates="venue", cascade="all, delete-orphan"
    )
    venue_facilities: Mapped[List["VenueFacility"]] = relationship(
        "VenueFacility", back_populates="venue", cascade="all, delete-orphan"
    )
    subscriptions: Mapped[List["Subscription"]] = relationship(
        "Subscription", back_populates="venue", cascade="all, delete-orphan"
    )
    ratings: Mapped[List["Rating"]] = relationship(
        "Rating", back_populates="venue", cascade="all, delete-orphan"
    )


class VenueImage(Base):
    __tablename__ = "venue_images"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ON DELETE CASCADE = daca se sterge venue-ul, se sterg si imaginile
    venue_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("venues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    url: Mapped[str] = mapped_column(String(500), nullable=False)

    # Ordinea de afisare in galerie
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    # Poza principala (thumbnail, card preview)
    is_cover: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )

    # Relationships
    venue: Mapped["Venue"] = relationship("Venue", back_populates="images")
