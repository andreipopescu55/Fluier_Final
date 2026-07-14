"""
CRUD pentru chat-ul de meci (Find Party).

Punctul interesant: listarea e INCREMENTALA (keyset pagination). Frontend-ul
face polling cu `after=<id ultimului mesaj vazut>` si primeste DOAR mesajele
mai noi — raspunsul e gol in majoritatea tick-urilor, deci traficul ramane
minuscul. Cursor = (created_at, id), nu OFFSET: stabil la insertii concurente
si acoperit de indexul (match_id, created_at).
"""
import uuid
from typing import Optional, Sequence

from sqlalchemy import select, tuple_
from sqlalchemy.orm import Session, joinedload

from app.models.match import Match, MatchMessage
from app.models.enums import ParticipantStatus


def is_chat_member(match: Match, user_id: uuid.UUID) -> bool:
    """
    Conversatia e privata echipei: organizatorul + participantii APROBATI.
    Cei cu cerere in asteptare / respinsi / iesiti nu au acces (in chat pot
    aparea telefoane si alte detalii private).
    """
    if match.organizer_id == user_id:
        return True
    return any(
        p.user_id == user_id and p.status == ParticipantStatus.APPROVED
        for p in match.participants
    )


def list_messages(
    db: Session,
    match_id: uuid.UUID,
    *,
    after_id: Optional[uuid.UUID] = None,
    limit: int = 50,
) -> Sequence[MatchMessage]:
    """
    Mesajele unui meci, in ordine cronologica.

    Fara `after_id`: ultimele `limit` mesaje (incarcarea initiala).
    Cu `after_id`: doar mesajele de DUPA acel mesaj (polling incremental).
    Un `after_id` necunoscut (ex: mesaj din alt meci) e ignorat -> incarcare initiala.
    """
    base = (
        select(MatchMessage)
        .where(MatchMessage.match_id == match_id)
        .options(joinedload(MatchMessage.user))
    )

    if after_id is not None:
        anchor = db.get(MatchMessage, after_id)
        if anchor is not None and anchor.match_id == match_id:
            stmt = (
                base.where(
                    tuple_(MatchMessage.created_at, MatchMessage.id)
                    > tuple_(anchor.created_at, anchor.id)
                )
                .order_by(MatchMessage.created_at.asc(), MatchMessage.id.asc())
                .limit(limit)
            )
            return db.execute(stmt).scalars().all()

    # Incarcare initiala: ultimele `limit`, intoarse cronologic.
    stmt = base.order_by(
        MatchMessage.created_at.desc(), MatchMessage.id.desc()
    ).limit(limit)
    newest_first = db.execute(stmt).scalars().all()
    return list(reversed(newest_first))


def create_message(
    db: Session,
    *,
    match_id: uuid.UUID,
    user_id: uuid.UUID,
    body: str,
) -> MatchMessage:
    msg = MatchMessage(match_id=match_id, user_id=user_id, body=body)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def add_system_message(db: Session, match_id: uuid.UUID, text: str) -> MatchMessage:
    """Mesaj automat (user_id NULL) — cronologia meciului in chat."""
    msg = MatchMessage(match_id=match_id, user_id=None, body=text)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg
