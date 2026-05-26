import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, BigInteger, text, ForeignKey, Uuid, Index
from sqlalchemy.dialects.postgresql import TIMESTAMP, JSONB, INET
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    # BigInteger (64-bit) in loc de Integer (32-bit) — logul poate creste la milioane de randuri
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # NULL daca actiunea a fost facuta de sistem, nu de un user
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Ce actiune s-a executat (ex: "booking.cancelled", "venue.approved")
    action: Mapped[str] = mapped_column(String(100), nullable=False)

    # Tipul entitatii afectate (ex: "booking", "venue", "user")
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # ID-ul entitatii afectate
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)

    # Date extra despre actiune (ex: valorile vechi/noi ale campurilor modificate)
    metadata_: Mapped[Optional[dict]] = mapped_column(
        "metadata", JSONB, nullable=True
    )

    # INET = tip PostgreSQL pentru IP (suporta IPv4 si IPv6)
    ip_address: Mapped[Optional[str]] = mapped_column(INET, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )

    __table_args__ = (
        # Index compus pentru query-ul principal: "toate actiunile pe entitatea X cu ID Y"
        Index("idx_audit_entity", "entity_type", "entity_id"),
        Index("idx_audit_created", "created_at"),
    )

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")
