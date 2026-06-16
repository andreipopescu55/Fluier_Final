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
from app.crud import venue_crud, rating_crud
from app.models.user import User
from app.models.enums import UserRole, VenueStatus, SportType
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
    summary="Lista publica de baze sportive aprobate (cu cautare/filtrare)",
)
def list_venues(
    q: Optional[str] = Query(None, description="Cautare in nume/oras/judet"),
    city: Optional[str] = Query(None, description="Filtru dupa oras"),
    county: Optional[str] = Query(None, description="Filtru dupa judet"),
    sport: Optional[SportType] = Query(None, description="Doar baze cu teren activ de acest sport"),
    format: Optional[str] = Query(None, description="Format liber ('5+1', 'Fotbal 7+1') — recomandare sau categorie"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    Endpoint public — nu cere auth.
    Returneaza doar venue-uri cu status='approved', cu filtre optionale.
    """
    venues = venue_crud.list_public(
        db, q=q, city=city, county=county, sport=sport, fmt=format, limit=limit, offset=offset
    )
    # Atasam media + numarul de rating-uri (un singur query agregat).
    summaries = rating_crud.get_summaries(db, [v.id for v in venues])
    for v in venues:
        v.rating_avg, v.rating_count = summaries.get(v.id, (None, 0))
    return venues


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
    venue.rating_avg, venue.rating_count = rating_crud.get_summary(db, venue.id)
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
