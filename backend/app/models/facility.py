import uuid
from typing import Optional, List

from sqlalchemy import String, Integer, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Facility(Base):
    __tablename__ = "facilities"

    # SERIAL in PostgreSQL = autoincrement integer
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Cod unic folosit in cod (ex: "lighting"), nu se schimba
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    # Text afisat in UI (ex: "Nocturna")
    label: Mapped[str] = mapped_column(String(100), nullable=False)

    # Numele iconitei (ex: "lightbulb" pentru o librarie de iconite)
    icon: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Relationships
    venue_facilities: Mapped[List["VenueFacility"]] = relationship(
        "VenueFacility", back_populates="facility"
    )


class VenueFacility(Base):
    __tablename__ = "venue_facilities"

    # Cheie primara compusa — combinatia (venue_id, facility_id) trebuie sa fie unica
    venue_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("venues.id", ondelete="CASCADE"),
        primary_key=True,
    )
    facility_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("facilities.id"),
        primary_key=True,
        index=True,
    )

    # Relationships
    venue: Mapped["Venue"] = relationship("Venue", back_populates="venue_facilities")
    facility: Mapped["Facility"] = relationship("Facility", back_populates="venue_facilities")
