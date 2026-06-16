import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import (
    String, Text, Numeric, CheckConstraint,
    Enum as SAEnum, text, ForeignKey, Uuid, Index,
)
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import BookingStatus, BookingSource


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ON DELETE RESTRICT = nu poti sterge un teren care are rezervari
    field_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("fields.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # ON DELETE SET NULL = daca userul e sters, rezervarea ramane (cu user_id = NULL)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    start_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)

    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default=text("'RON'"))

    # Avans (50% din total) platit cu cardul pentru confirmare. Restul se achita
    # la baza sportiva. NULL pentru rezervari fara avans (ex: blocari manuale).
    deposit_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)

    status: Mapped[BookingStatus] = mapped_column(
        SAEnum(BookingStatus, name="booking_status", create_type=False, values_callable=lambda e: [v.value for v in e]),
        nullable=False,
        server_default=text("'pending'"),
        index=True,
    )

    # online = rezervat de client din app; manual = adaugat de admin direct
    booking_source: Mapped[BookingSource] = mapped_column(
        SAEnum(BookingSource, name="booking_source", create_type=False, values_callable=lambda e: [v.value for v in e]),
        nullable=False,
        server_default=text("'online'"),
    )

    # Campuri pentru rezervari manuale (admin adauga pentru un client extern)
    customer_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Cine si cand a anulat rezervarea
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    cancelled_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )

    __table_args__ = (
        CheckConstraint("end_time > start_time", name="chk_booking_time"),
        CheckConstraint("total_price >= 0", name="chk_booking_price"),
        # Index compus pentru query-ul cel mai frecvent: "ce rezervari are terenul X intre ora A si B?"
        Index("idx_bookings_time", "field_id", "start_time", "end_time"),
        # NOTA: constraint-ul EXCLUDE anti double-booking este adaugat via SQL raw in init_db.py
        # Motiv: necesita tstzrange() si sintaxa SQLAlchemy ExcludeConstraint e inconsistenta cu psycopg3
    )

    # Relationships
    field: Mapped["Field"] = relationship("Field", back_populates="bookings")

    # foreign_keys explicit — Booking are doua FK catre users (user_id si cancelled_by_id)
    user: Mapped[Optional["User"]] = relationship(
        "User", back_populates="bookings", foreign_keys=[user_id]
    )
    cancelled_by: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[cancelled_by_id]
    )
    payments: Mapped[List["Payment"]] = relationship("Payment", back_populates="booking")
