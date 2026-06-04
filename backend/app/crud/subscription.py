"""
CRUD pe Subscription.

NOTA: aceasta este o implementare MOCK pentru v1 — nu apeleaza Stripe real.
Genereaza ID-uri 'stripe' fictive si seteaza o perioada de 30 de zile.
Inlocuirea cu Stripe real inseamna doar: crearea sesiunii Checkout + un webhook
care apeleaza aceleasi functii de mai jos cu ID-urile reale din Stripe.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.subscription import Subscription
from app.models.enums import SubscriptionPlan, SubscriptionStatus

PERIOD_DAYS = 30


def get_for_venue(db: Session, venue_id: uuid.UUID) -> Optional[Subscription]:
    """Cea mai recenta subscriptie a unui venue (sau None)."""
    stmt = (
        select(Subscription)
        .where(Subscription.venue_id == venue_id)
        .order_by(Subscription.created_at.desc())
    )
    return db.execute(stmt).scalars().first()


def subscribe_mock(db: Session, venue_id: uuid.UUID, plan: SubscriptionPlan) -> Subscription:
    """
    Activeaza (sau reactiveaza) un abonament pentru venue.
    Reutilizeaza randul existent daca exista, altfel creeaza unul nou.
    """
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=PERIOD_DAYS)
    sub = get_for_venue(db, venue_id)

    if sub is None:
        sub = Subscription(
            venue_id=venue_id,
            stripe_customer_id=f"mock_cus_{uuid.uuid4().hex[:14]}",
            stripe_subscription_id=f"mock_sub_{uuid.uuid4().hex[:14]}",
            plan=plan,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=now,
            current_period_end=end,
            cancel_at_period_end=False,
        )
    else:
        sub.plan = plan
        sub.status = SubscriptionStatus.ACTIVE
        sub.current_period_start = now
        sub.current_period_end = end
        sub.cancel_at_period_end = False

    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def cancel(db: Session, sub: Subscription) -> Subscription:
    """Anulare la sfarsitul perioadei (raman activi pana la current_period_end)."""
    sub.cancel_at_period_end = True
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub
