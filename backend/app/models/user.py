import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import String, Boolean, Enum as SAEnum, text, Uuid
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import UserRole


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)

    # Parola poate lipsi daca userul se autentifica via OAuth (Google, etc.)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role", create_type=False),
        nullable=False,
        server_default=text("'client'"),
    )

    # Campuri pentru autentificare OAuth (ex: "google", "facebook")
    oauth_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    oauth_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    email_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )

    # Relationships
    # "Venue" e string, nu referinta directa — evita importuri circulare
    venues: Mapped[List["Venue"]] = relationship(
        "Venue", back_populates="owner", foreign_keys="[Venue.owner_id]"
    )
    bookings: Mapped[List["Booking"]] = relationship(
        "Booking", back_populates="user", foreign_keys="[Booking.user_id]"
    )
    notifications: Mapped[List["Notification"]] = relationship(
        "Notification", back_populates="user"
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog", back_populates="user"
    )
