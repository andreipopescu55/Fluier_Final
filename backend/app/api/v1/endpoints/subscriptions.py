"""
Endpoint-uri pentru abonamentul lunar al unui venue (MOCK v1 — fara Stripe real).

  GET  /venues/{venue_id}/subscription         -> abonamentul curent (sau null)
  POST /venues/{venue_id}/subscription         -> activeaza un plan (basic/premium)
  POST /venues/{venue_id}/subscription/cancel  -> anuleaza la sfarsitul perioadei

Inlocuirea cu Stripe real: POST-ul ar crea o sesiune Checkout si ar returna URL-ul;
un webhook ar apela subscription_crud.subscribe_mock(...) cu ID-urile reale.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.crud import venue_crud, subscription_crud
from app.models.user import User
from app.models.venue import Venue
from app.models.enums import UserRole
from app.schemas.subscription import SubscribeRequest, SubscriptionOut


router = APIRouter(prefix="/venues/{venue_id}/subscription", tags=["subscriptions"])


def _ensure_owner_of_venue(venue_id: uuid.UUID, db: Session, current_user: User) -> Venue:
    venue = venue_crud.get_by_id(db, venue_id)
    if venue is None:
        raise HTTPException(status_code=404, detail="Venue inexistent")
    if venue.owner_id != current_user.id and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Nu detii acest venue")
    return venue


@router.get("", response_model=Optional[SubscriptionOut], summary="Abonamentul curent al bazei")
def get_subscription(
    venue_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.VENUE_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    _ensure_owner_of_venue(venue_id, db, current_user)
    return subscription_crud.get_for_venue(db, venue_id)


@router.post("", response_model=SubscriptionOut, summary="Activeaza un plan (mock, fara plata reala)")
def subscribe(
    venue_id: uuid.UUID,
    payload: SubscribeRequest,
    current_user: User = Depends(require_role(UserRole.VENUE_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    _ensure_owner_of_venue(venue_id, db, current_user)
    return subscription_crud.subscribe_mock(db, venue_id, payload.plan)


@router.post("/cancel", response_model=SubscriptionOut, summary="Anuleaza la sfarsitul perioadei")
def cancel_subscription(
    venue_id: uuid.UUID,
    current_user: User = Depends(require_role(UserRole.VENUE_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    _ensure_owner_of_venue(venue_id, db, current_user)
    sub = subscription_crud.get_for_venue(db, venue_id)
    if sub is None:
        raise HTTPException(status_code=404, detail="Nu exista abonament activ")
    return subscription_crud.cancel(db, sub)
