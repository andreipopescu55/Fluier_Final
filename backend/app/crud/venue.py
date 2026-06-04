"""
CRUD pe Venue. Functiile primesc sesiunea SQLAlchemy si datele;
nu cunosc FastAPI sau HTTP.
"""
import re
import uuid
from typing import Optional, Sequence

from sqlalchemy import select, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.venue import Venue
from app.models.field import Field
from app.models.enums import VenueStatus, SportType
from app.schemas.venue import VenueCreate, VenueUpdate


# ── Helper: slug ──────────────────────────────────────────────────────────────
def _slugify(text: str) -> str:
    """
    Transforma 'Complex Sportiv Bucur Obor' -> 'complex-sportiv-bucur-obor'.
    Simplu, nu acopera diacritice — pentru o licenta e suficient.
    Pentru productie ar trebui o lib precum python-slugify.
    """
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text


def _ensure_unique_slug(db: Session, base_slug: str) -> str:
    """
    Daca 'complex-sportiv-bucur' exista, returneaza 'complex-sportiv-bucur-2'.
    Bucla la max 100 iteratii ca safety.
    """
    slug = base_slug
    for i in range(2, 102):
        existing = db.execute(select(Venue).where(Venue.slug == slug)).scalar_one_or_none()
        if existing is None:
            return slug
        slug = f"{base_slug}-{i}"
    raise RuntimeError("Nu am gasit un slug unic dupa 100 incercari")


# ── CRUD ──────────────────────────────────────────────────────────────────────
def get_by_id(db: Session, venue_id: uuid.UUID) -> Optional[Venue]:
    return db.get(Venue, venue_id)


def get_by_slug(db: Session, slug: str) -> Optional[Venue]:
    stmt = select(Venue).where(Venue.slug == slug)
    return db.execute(stmt).scalar_one_or_none()


def list_public(db: Session, *, q: Optional[str] = None,
                city: Optional[str] = None, county: Optional[str] = None,
                sport: Optional[SportType] = None,
                limit: int = 50, offset: int = 0) -> Sequence[Venue]:
    """
    Lista publica — doar venue-uri 'approved'.
    Filtre optionale:
      - q     : text liber, cauta in nume/oras/judet (case-insensitive)
      - city  : oras exact (case-insensitive)
      - county: judet exact (case-insensitive)
      - sport : doar baze care au cel putin un teren ACTIV de acel sport
    """
    stmt = select(Venue).where(Venue.status == VenueStatus.APPROVED)

    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(Venue.name.ilike(like), Venue.city.ilike(like), Venue.county.ilike(like))
        )
    if city:
        stmt = stmt.where(Venue.city.ilike(city))
    if county:
        stmt = stmt.where(Venue.county.ilike(county))
    if sport is not None:
        # Sub-query: id-urile bazelor care au un teren activ de tipul cerut.
        venue_ids = select(Field.venue_id).where(
            Field.sport_type == sport, Field.is_active.is_(True)
        )
        stmt = stmt.where(Venue.id.in_(venue_ids))

    stmt = stmt.order_by(Venue.created_at.desc()).limit(limit).offset(offset)
    return db.execute(stmt).scalars().all()


def list_by_owner(db: Session, owner_id: uuid.UUID) -> Sequence[Venue]:
    """Lista venue-urilor unui owner — include si pending/suspended."""
    stmt = select(Venue).where(Venue.owner_id == owner_id).order_by(Venue.created_at.desc())
    return db.execute(stmt).scalars().all()


def list_all(db: Session, *, status: Optional[VenueStatus] = None) -> Sequence[Venue]:
    """TOATE bazele (pentru moderare super_admin), filtru optional dupa status."""
    stmt = select(Venue)
    if status is not None:
        stmt = stmt.where(Venue.status == status)
    # pending-urile primele (asteapta moderare), apoi cele mai noi.
    stmt = stmt.order_by(Venue.status.asc(), Venue.created_at.desc())
    return db.execute(stmt).scalars().all()


def set_status(db: Session, venue: Venue, status: VenueStatus) -> Venue:
    """Schimba statusul unei baze (aprobare/suspendare) — apelat doar de super_admin."""
    venue.status = status
    db.add(venue)
    db.commit()
    db.refresh(venue)
    return venue


def create(db: Session, data: VenueCreate, owner_id: uuid.UUID) -> Venue:
    """
    Creeaza un venue nou.
    - Daca slug e None, il genereaza din name.
    - Asigura unicitatea slug-ului (append -2, -3 etc daca exista coliziune).
    - Status implicit = 'pending' (asteapta moderare).
    """
    raw_slug = data.slug or _slugify(data.name)
    final_slug = _ensure_unique_slug(db, raw_slug)

    venue = Venue(
        owner_id=owner_id,
        name=data.name,
        slug=final_slug,
        description=data.description,
        address=data.address,
        city=data.city,
        county=data.county,
        latitude=data.latitude,
        longitude=data.longitude,
        phone=data.phone,
        opening_time=data.opening_time,
        closing_time=data.closing_time,
        # status implicit 'pending' din server_default
    )
    db.add(venue)
    try:
        db.commit()
    except IntegrityError:
        # Race condition rara: doi useri creeaza acelasi slug simultan.
        # Re-incearca cu un slug nou.
        db.rollback()
        venue.slug = _ensure_unique_slug(db, raw_slug)
        db.add(venue)
        db.commit()
    db.refresh(venue)
    return venue


def update(db: Session, venue: Venue, data: VenueUpdate) -> Venue:
    """
    Aplica modificarile non-None din `data` pe `venue`.
    PATCH-style: campurile None inseamna "nu schimba".
    """
    # model_dump(exclude_unset=True) = doar campurile pe care clientul le-a trimis.
    # exclude_none=False ar ramane = clientul poate explicit seta un camp la null.
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(venue, field, value)

    db.add(venue)
    db.commit()
    db.refresh(venue)
    return venue


def delete(db: Session, venue: Venue) -> None:
    db.delete(venue)
    db.commit()
