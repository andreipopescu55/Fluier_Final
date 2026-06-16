import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Integer, Text, CheckConstraint, UniqueConstraint, text, ForeignKey, Uuid,
)
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Rating(Base):
    """Evaluarea unei baze sportive de catre un utilizator (1-5 stele + comentariu)."""

    __tablename__ = "ratings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)

    venue_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("venues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Daca userul e sters, ii stergem si rating-urile.
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    score: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )

    __table_args__ = (
        CheckConstraint("score BETWEEN 1 AND 5", name="chk_rating_score"),
        # Un singur rating per (user, venue) — al doilea PUT actualizeaza primul.
        UniqueConstraint("venue_id", "user_id", name="uq_rating_user_venue"),
    )

    venue: Mapped["Venue"] = relationship("Venue", back_populates="ratings")
    user: Mapped["User"] = relationship("User")
