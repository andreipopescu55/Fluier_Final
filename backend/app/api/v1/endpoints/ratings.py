"""
Rating pe baze sportive (1-5 stele).

  GET    /venues/{venue_id}/rating   -> sumar public (media + numar) + scorul meu daca sunt logat
  PUT    /venues/{venue_id}/rating   -> creeaza/actualizeaza rating-ul meu
  DELETE /venues/{venue_id}/rating   -> sterge rating-ul meu
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.crud import venue_crud, rating_crud
from app.models.user import User
from app.models.enums import VenueStatus
from app.schemas.rating import RatingCreate, RatingSummary


router = APIRouter(prefix="/venues/{venue_id}/rating", tags=["ratings"])


def _venue_or_404(venue_id: uuid.UUID, db: Session, require_approved: bool = False):
    venue = venue_crud.get_by_id(db, venue_id)
    if venue is None or (require_approved and venue.status != VenueStatus.APPROVED):
        raise HTTPException(status_code=404, detail="Bază inexistentă")
    return venue


def _summary(db: Session, venue_id: uuid.UUID, user: Optional[User]) -> RatingSummary:
    avg, count = rating_crud.get_summary(db, venue_id)
    my_score = None
    can_rate = False
    if user is not None:
        existing = rating_crud.get_user_rating(db, venue_id, user.id)
        my_score = existing.score if existing else None
        can_rate = rating_crud.user_has_played(db, venue_id, user.id)
    return RatingSummary(average=avg, count=count, my_score=my_score, can_rate=can_rate)


@router.get("", response_model=RatingSummary, summary="Sumar rating (public)")
def get_rating(
    venue_id: uuid.UUID,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    _venue_or_404(venue_id, db)
    return _summary(db, venue_id, current_user)


@router.put("", response_model=RatingSummary, summary="Adauga/actualizeaza rating-ul meu")
def put_rating(
    venue_id: uuid.UUID,
    payload: RatingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _venue_or_404(venue_id, db, require_approved=True)
    # Poti evalua doar daca ai jucat efectiv aici (rezervare trecuta, neanulata).
    if not rating_crud.user_has_played(db, venue_id, current_user.id):
        raise HTTPException(
            status_code=403,
            detail="Poți evalua doar după ce ai jucat aici (după ce trece intervalul rezervat).",
        )
    rating_crud.upsert(db, venue_id, current_user.id, payload.score, payload.comment)
    return _summary(db, venue_id, current_user)


@router.delete("", response_model=RatingSummary, summary="Sterge rating-ul meu")
def delete_rating(
    venue_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _venue_or_404(venue_id, db)
    rating_crud.delete_user_rating(db, venue_id, current_user.id)
    return _summary(db, venue_id, current_user)
