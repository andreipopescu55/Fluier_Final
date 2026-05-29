"""
Endpoint-uri pentru bazele sportive (venues).
- Public: listare + detalii (doar status='approved').
- Venue admin: CRUD pe venue-urile proprii.
- Super admin: poate edita/sterge orice (handled in deps).
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_role
from app.crud import venue_crud
from app.models.user import User
from app.models.enums import UserRole, VenueStatus
from app.models.venue import Venue
from app.schemas.venue import VenueCreate, VenueUpdate, VenueOut, VenueListItem


router = APIRouter(prefix="/venues", tags=["venues"])


# ── Helper: verifica ownership ─────────────────────────────────────────────────
def _get_venue_for_admin(
    venue_id: uuid.UUID,
    db: Session,
    current_user: User,
) -> Venue:
    """
    Incarca venue-ul si verifica drepturile.
    - super_admin poate orice
    - venue_admin doar pe venue-urile proprii
    Returneaza 404 daca venue-ul nu exista, 403 daca nu are drept.
    """
    venue = venue_crud.get_by_id(db, venue_id)
    if venue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue inexistent")

    is_owner = venue.owner_id == current_user.id
    is_super = current_user.role == UserRole.SUPER_ADMIN
    if not (is_owner or is_super):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nu ai permisiune pe acest venue",
        )
    return venue


# ── Public endpoints ──────────────────────────────────────────────────────────
@router.get(
    "",
    response_model=list[VenueListItem],
    summary="Lista publica de baze sportive aprobate",
)
def list_venues(
    city: Optional[str] = Query(None, description="Filtru optional dupa oras"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    Endpoint public — nu cere auth.
    Returneaza doar venue-uri cu status='approved'.
    """
    return venue_crud.list_public(db, city=city, limit=limit, offset=offset)


@router.get(
    "/me",
    response_model=list[VenueOut],
    summary="Venue-urile mele (ca venue_admin)",
)
def my_venues(
    current_user: User = Depends(require_role(UserRole.VENUE_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Lista venue-urilor pe care le detin — include si pending/suspended.
    Definita INAINTEA /venues/{slug} ca sa nu se confunde 'me' cu un slug.
    """
    return venue_crud.list_by_owner(db, current_user.id)


@router.get(
    "/{slug}",
    response_model=VenueOut,
    summary="Detaliile unui venue dupa slug",
)
def get_venue(slug: str, db: Session = Depends(get_db)):
    """
    Endpoint public pe slug (URL-friendly): /venues/complex-sportiv-bucur.
    Nu returneaza venue-uri ne-aprobate (404 daca user incearca direct).
    """
    venue = venue_crud.get_by_slug(db, slug)
    if venue is None or venue.status != VenueStatus.APPROVED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venue inexistent")
    return venue


# ── Admin endpoints (cer auth + rol) ───────────────────────────────────────────
@router.post(
    "",
    response_model=VenueOut,
    status_code=status.HTTP_201_CREATED,
    summary="Creare venue nou (devine pending pana la moderare)",
)
def create_venue(
    payload: VenueCreate,
    current_user: User = Depends(require_role(UserRole.VENUE_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """
    Doar venue_admin si super_admin pot crea venue-uri.
    Venue-ul porneste cu status='pending' — un super_admin trebuie sa-l aprobe.
    """
    return venue_crud.create(db, payload, owner_id=current_user.id)


@router.patch(
    "/{venue_id}",
    response_model=VenueOut,
    summary="Actualizare partiala venue (PATCH)",
)
def update_venue(
    venue_id: uuid.UUID,
    payload: VenueUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    venue = _get_venue_for_admin(venue_id, db, current_user)
    return venue_crud.update(db, venue, payload)


@router.delete(
    "/{venue_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sterge un venue (cascade pe fields/images/etc.)",
)
def delete_venue(
    venue_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    venue = _get_venue_for_admin(venue_id, db, current_user)
    venue_crud.delete(db, venue)
    # 204 = success fara body
