"""CRUD pe Rating: upsert (un rating per user/venue) + agregate (media + numar)."""
import uuid
from datetime import datetime, timezone
from typing import Optional, Sequence

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.rating import Rating
from app.models.booking import Booking
from app.models.field import Field
from app.models.enums import BookingStatus


def user_has_played(db: Session, venue_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    """
    True daca userul are la aceasta baza o rezervare al carei interval S-A TERMINAT
    deja (end_time < acum) si NU e anulata — adica a jucat efectiv acolo.
    Conditie ca sa poata lasa un rating.
    """
    now = datetime.now(timezone.utc)
    stmt = (
        select(Booking.id)
        .join(Field, Field.id == Booking.field_id)
        .where(
            Field.venue_id == venue_id,
            Booking.user_id == user_id,
            Booking.end_time < now,
            Booking.status != BookingStatus.CANCELLED,
        )
        .limit(1)
    )
    return db.execute(stmt).first() is not None


def get_user_rating(db: Session, venue_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Rating]:
    stmt = select(Rating).where(Rating.venue_id == venue_id, Rating.user_id == user_id)
    return db.execute(stmt).scalar_one_or_none()


def upsert(db: Session, venue_id: uuid.UUID, user_id: uuid.UUID,
           score: int, comment: Optional[str]) -> Rating:
    """Creeaza sau actualizeaza rating-ul userului pentru o baza."""
    rating = get_user_rating(db, venue_id, user_id)
    if rating is None:
        rating = Rating(venue_id=venue_id, user_id=user_id, score=score, comment=comment)
    else:
        rating.score = score
        rating.comment = comment
        rating.updated_at = datetime.now(timezone.utc)
    db.add(rating)
    db.commit()
    db.refresh(rating)
    return rating


def delete_user_rating(db: Session, venue_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    rating = get_user_rating(db, venue_id, user_id)
    if rating is None:
        return False
    db.delete(rating)
    db.commit()
    return True


def get_summary(db: Session, venue_id: uuid.UUID) -> tuple[Optional[float], int]:
    """(media rotunjita la 1 zecimala, numar evaluari) pentru o baza."""
    row = db.execute(
        select(func.avg(Rating.score), func.count(Rating.id)).where(Rating.venue_id == venue_id)
    ).one()
    avg, count = row
    return (round(float(avg), 1) if avg is not None else None, int(count))


def get_summaries(db: Session, venue_ids: Sequence[uuid.UUID]) -> dict[uuid.UUID, tuple[Optional[float], int]]:
    """Agregate pentru mai multe baze deodata (folosit la listare)."""
    if not venue_ids:
        return {}
    rows = db.execute(
        select(Rating.venue_id, func.avg(Rating.score), func.count(Rating.id))
        .where(Rating.venue_id.in_(venue_ids))
        .group_by(Rating.venue_id)
    ).all()
    return {vid: (round(float(avg), 1), int(count)) for vid, avg, count in rows}
