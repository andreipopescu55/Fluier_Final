import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import (
    String, Boolean, Numeric, CheckConstraint,
    Enum as SAEnum, text, ForeignKey, Uuid,
)
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.enums import SubscriptionPlan, SubscriptionStatus, PaymentStatus


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)

    venue_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("venues.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ID-uri din Stripe (platforma de plati) — necesare pentru webhooks si management
    stripe_customer_id: Mapped[str] = mapped_column(String(255), nullable=False)
    stripe_subscription_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)

    plan: Mapped[SubscriptionPlan] = mapped_column(
        SAEnum(SubscriptionPlan, name="subscription_plan", create_type=False, values_callable=lambda e: [v.value for v in e]),
        nullable=False,
        server_default=text("'basic'"),
    )

    status: Mapped[SubscriptionStatus] = mapped_column(
        SAEnum(SubscriptionStatus, name="subscription_status", create_type=False, values_callable=lambda e: [v.value for v in e]),
        nullable=False,
        index=True,
    )

    # Perioada curenta de facturare
    current_period_start: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    current_period_end: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)

    # Daca True, abonamentul se anuleaza la sfarsitul perioadei curente (nu imediat)
    cancel_at_period_end: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )

    # Relationships
    venue: Mapped["Venue"] = relationship("Venue", back_populates="subscriptions")
    payments: Mapped[List["Payment"]] = relationship("Payment", back_populates="subscription")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # O plata e fie pentru un abonament, fie pentru o rezervare — niciodata ambele
    subscription_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("subscriptions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    booking_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("bookings.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ID din Stripe pentru reconciliere
    stripe_payment_intent_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)

    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default=text("'RON'"))

    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus, name="payment_status", create_type=False, values_callable=lambda e: [v.value for v in e]),
        nullable=False,
        index=True,
    )

    # NULL daca plata nu s-a finalizat inca
    paid_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("NOW()")
    )

    __table_args__ = (
        CheckConstraint("amount >= 0", name="chk_payment_amount"),
        # Exact unul dintre cele doua campuri trebuie sa fie NOT NULL
        CheckConstraint(
            "(subscription_id IS NOT NULL AND booking_id IS NULL) OR "
            "(subscription_id IS NULL AND booking_id IS NOT NULL)",
            name="chk_payment_target",
        ),
    )

    # Relationships
    subscription: Mapped[Optional["Subscription"]] = relationship(
        "Subscription", back_populates="payments"
    )
    booking: Mapped[Optional["Booking"]] = relationship(
        "Booking", back_populates="payments"
    )
