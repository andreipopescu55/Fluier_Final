import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, Boolean, Enum as SAEnum, text, ForeignKey, Uuid, Index
from sqlalchemy.dialects.postgresql import TIMESTAMP, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import NotificationType


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    type: Mapped[NotificationType] = mapped_column(
        SAEnum(NotificationType, name="notification_type", create_type=False),
        nullable=False,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))

    # JSONB pentru date variabile per tip de notificare
    # Ex: {"booking_id": "uuid", "field_name": "Teren 1"}
    # "metadata" e rezervat in SQLAlchemy — folosim metadata_ in Python, "metadata" in DB
    metadata_: Mapped[Optional[dict]] = mapped_column(
        "metadata", JSONB, nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )

    __table_args__ = (
        # Index compus pentru cel mai frecvent query: notificarile necitite ale unui user
        Index("idx_notifications_user_unread", "user_id", "is_read"),
        Index("idx_notifications_created", "created_at"),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="notifications")
