"""CRUD pe Rating: upsert (un rating per user/venue) + agregate (media + numar)."""
import uuid
from datetime import datetime, timezone
from typing import Optional, Sequence

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.rating import Rating
from app.models.booking import Booking
from app.models.field import Field
from app.models.match import Match, MatchParticipant
from app.models.enums import BookingStatus, ParticipantStatus


def user_has_played(db: Session, venue_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    """
    True daca userul a jucat efectiv la aceasta baza — conditie ca sa poata lasa
    un rating. "A jucat" inseamna ca exista un interval deja terminat (end_time <
    acum) si neanulat, in oricare din situatii:
      (a) userul e proprietarul rezervarii, SAU
      (b) userul a fost participant APROBAT la un meci deschis pe acea rezervare.
    Astfel si cei care s-au alaturat unui meci (nu doar organizatorul) pot evalua.
    """
    now = datetime.now(timezone.utc)

    # (a) Rezervare proprie, trecuta, neanulata.
    own = (
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
    if db.execute(own).first() is not None:
        return True

    # (b) Participant aprobat la un meci pe o rezervare trecuta, neanulata.
    played = (
        select(MatchParticipant.id)
        .join(Match, Match.id == MatchParticipant.match_id)
        .join(Booking, Booking.id == Match.booking_id)
        .join(Field, Field.id == Booking.field_id)
        .where(
            Field.venue_id == venue_id,
            MatchParticipant.user_id == user_id,
            MatchParticipant.status == ParticipantStatus.APPROVED,
            Booking.end_time < now,
            Booking.status != BookingStatus.CANCELLED,
        )
        .limit(1)
    )
    return db.execute(played).first() is not None


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
