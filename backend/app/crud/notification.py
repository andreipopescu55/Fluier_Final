"""
CRUD + evenimente pentru Notification (inbox-ul per rol).

Doua niveluri:
  1. Operatii generice: creare, listare, contor necitite, marcare ca citit.
  2. Helperi de evenimente (notify_*): fiecare actiune importanta din aplicatie
     (rezervare noua, cerere Find Party, modificare de teren etc.) apeleaza un
     helper care compune titlul/corpul in romana si insereaza notificarea
     pentru destinatarul potrivit (client / venue admin / super admin).

Notificarile se creeaza DUPA ce actiunea principala a reusit (commit separat):
daca actiunea esueaza, nu ramane nicio notificare orfana.
"""
import uuid
from datetime import datetime
from typing import Optional, Sequence
from zoneinfo import ZoneInfo

from sqlalchemy import select, func, update
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User
from app.models.enums import NotificationType, UserRole

LOCAL_TZ = ZoneInfo("Europe/Bucharest")


# ── Operatii generice ───────────────────────────────────────────────────────────
def create_notification(
    db: Session,
    *,
    user_id: uuid.UUID,
    type: NotificationType,
    title: str,
    body: Optional[str] = None,
    metadata: Optional[dict] = None,
    commit: bool = True,
) -> Notification:
    notif = Notification(
        user_id=user_id, type=type, title=title, body=body, metadata_=metadata
    )
    db.add(notif)
    if commit:
        db.commit()
        db.refresh(notif)
    return notif


def list_for_user(
    db: Session,
    user_id: uuid.UUID,
    *,
    only_unread: bool = False,
    limit: int = 50,
) -> Sequence[Notification]:
    """Notificarile unui user, cele mai recente primele."""
    stmt = select(Notification).where(Notification.user_id == user_id)
    if only_unread:
        stmt = stmt.where(Notification.is_read.is_(False))
    stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)
    return db.execute(stmt).scalars().all()


def unread_count(db: Session, user_id: uuid.UUID) -> int:
    stmt = select(func.count()).select_from(Notification).where(
        Notification.user_id == user_id,
        Notification.is_read.is_(False),
    )
    return db.execute(stmt).scalar_one()


def get_by_id(db: Session, notification_id: uuid.UUID) -> Optional[Notification]:
    return db.get(Notification, notification_id)


def mark_read(db: Session, notif: Notification) -> Notification:
    """Citita -> trece in istoric (ramane in tabela, cu is_read=true)."""
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


def mark_all_read(db: Session, user_id: uuid.UUID) -> int:
    """Muta toate necititele in istoric. Returneaza cate au fost."""
    result = db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    db.commit()
    return result.rowcount


# ── Helpers de formatare ────────────────────────────────────────────────────────
def _fmt_interval(start: datetime, end: datetime) -> str:
    """'10.07, 19:00–21:00' in ora locala (intervalul unei rezervari)."""
    s = start.astimezone(LOCAL_TZ)
    e = end.astimezone(LOCAL_TZ)
    return f"{s:%d.%m}, {s:%H:%M}–{e:%H:%M}"


def _super_admin_ids(db: Session) -> Sequence[uuid.UUID]:
    stmt = select(User.id).where(
        User.role == UserRole.SUPER_ADMIN, User.is_active.is_(True)
    )
    return db.execute(stmt).scalars().all()


# ── Evenimente: rezervari (client + venue admin) ────────────────────────────────
def notify_booking_confirmed(db: Session, booking, field, venue, customer_name: str) -> None:
    """Clientul a platit avansul -> confirmare pentru client + veste pentru admin."""
    interval = _fmt_interval(booking.start_time, booking.end_time)
    meta = {"booking_id": str(booking.id), "venue_id": str(venue.id)}
    if booking.user_id is not None:
        create_notification(
            db,
            user_id=booking.user_id,
            type=NotificationType.BOOKING_CONFIRMED,
            title="Rezervarea ta a fost confirmată",
            body=f"{venue.name} · {field.name} · {interval}. Avansul a fost înregistrat.",
            metadata=meta,
            commit=False,
        )
    if venue.owner_id != booking.user_id:
        create_notification(
            db,
            user_id=venue.owner_id,
            type=NotificationType.VENUE_NEW_BOOKING,
            title="Rezervare confirmată (avans plătit)",
            body=f"{customer_name} · {field.name} · {interval}.",
            metadata=meta,
            commit=False,
        )
    db.commit()


def notify_new_booking(db: Session, booking, field, venue, customer_name: str) -> None:
    """Rezervare online noua -> adminul bazei afla imediat."""
    if venue.owner_id == booking.user_id:
        return  # adminul si-a rezervat singur — nu se anunta pe sine
    create_notification(
        db,
        user_id=venue.owner_id,
        type=NotificationType.VENUE_NEW_BOOKING,
        title="Rezervare nouă",
        body=(
            f"{customer_name} a rezervat {field.name} · "
            f"{_fmt_interval(booking.start_time, booking.end_time)} (în așteptarea avansului)."
        ),
        metadata={"booking_id": str(booking.id), "venue_id": str(venue.id)},
    )


def notify_booking_cancelled(
    db: Session, booking, field, venue, cancelled_by
) -> None:
    """
    Anulare de rezervare — anuntam partea CEALALTA:
      - clientul anuleaza -> afla adminul bazei;
      - adminul/super-adminul anuleaza -> afla clientul.
    """
    interval = _fmt_interval(booking.start_time, booking.end_time)
    meta = {"booking_id": str(booking.id), "venue_id": str(venue.id)}
    cancelled_by_owner = booking.user_id is not None and cancelled_by.id == booking.user_id

    if cancelled_by_owner:
        if venue.owner_id != booking.user_id:
            create_notification(
                db,
                user_id=venue.owner_id,
                type=NotificationType.VENUE_BOOKING_CANCELLED,
                title="Rezervare anulată",
                body=(
                    f"{booking.customer_name or cancelled_by.full_name} a anulat "
                    f"{field.name} · {interval}."
                ),
                metadata=meta,
            )
    elif booking.user_id is not None:
        create_notification(
            db,
            user_id=booking.user_id,
            type=NotificationType.BOOKING_CANCELLED,
            title="Rezervarea ta a fost anulată",
            body=(
                f"{venue.name} · {field.name} · {interval}. "
                "Rezervarea a fost anulată de administrator; avansul plătit se returnează."
            ),
            metadata=meta,
        )


# ── Evenimente: Find Party (organizator + jucatori) ─────────────────────────────
def notify_join_request(db: Session, match, requester: User) -> None:
    """Cerere noua de alaturare -> organizatorul decide."""
    create_notification(
        db,
        user_id=match.organizer_id,
        type=NotificationType.MATCH_JOIN_REQUEST,
        title="Cerere nouă la meciul tău",
        body=f"{requester.full_name} vrea să intre în meci.",
        metadata={"match_id": str(match.id)},
    )


def notify_request_approved(db: Session, match, player_id: uuid.UUID) -> None:
    create_notification(
        db,
        user_id=player_id,
        type=NotificationType.MATCH_REQUEST_APPROVED,
        title="Ai fost acceptat în meci",
        body="Organizatorul ți-a aprobat cererea. Ești în echipă!",
        metadata={"match_id": str(match.id)},
    )


def notify_request_rejected(db: Session, match, player_id: uuid.UUID, was_approved: bool) -> None:
    create_notification(
        db,
        user_id=player_id,
        type=NotificationType.MATCH_REQUEST_REJECTED,
        title="Ai fost scos din meci" if was_approved else "Cererea ta a fost respinsă",
        body="Organizatorul a decis să elibereze locul." if was_approved
             else "Organizatorul nu ți-a acceptat cererea de data asta.",
        metadata={"match_id": str(match.id)},
    )


def notify_player_left(db: Session, match, player: User, was_approved: bool) -> None:
    """Un jucator a iesit (sau si-a retras cererea) -> afla organizatorul."""
    create_notification(
        db,
        user_id=match.organizer_id,
        type=NotificationType.MATCH_PLAYER_LEFT,
        title="Un jucător a ieșit din meci" if was_approved else "O cerere a fost retrasă",
        body=f"{player.full_name} " + ("a părăsit meciul — s-a eliberat un loc." if was_approved
                                       else "și-a retras cererea de alăturare."),
        metadata={"match_id": str(match.id)},
    )


def notify_match_cancelled(db: Session, match, participant_ids: Sequence[uuid.UUID]) -> None:
    """Organizatorul a anulat meciul -> toti cei inscrisi (aprobati + in asteptare)."""
    for pid in participant_ids:
        create_notification(
            db,
            user_id=pid,
            type=NotificationType.MATCH_CANCELLED,
            title="Meciul a fost anulat",
            body="Organizatorul a anulat meciul la care erai înscris.",
            metadata={"match_id": str(match.id)},
            commit=False,
        )
    db.commit()


# ── Evenimente: modificari de terenuri (super admin) ────────────────────────────
def notify_field_change(
    db: Session, *, actor: User, venue, field_name: str, action: str,
    field_id: Optional[uuid.UUID] = None,
) -> None:
    """
    Un venue_admin a modificat ceva la terenuri -> toti super-adminii activi.
    `action` e o propozitie scurta: 'a adăugat terenul', 'a șters tarifele' etc.
    Super-adminul nu se anunta pe sine (cand modifica el direct).
    """
    if actor.role == UserRole.SUPER_ADMIN:
        return
    meta = {"venue_id": str(venue.id)}
    if field_id is not None:
        meta["field_id"] = str(field_id)
    for admin_id in _super_admin_ids(db):
        create_notification(
            db,
            user_id=admin_id,
            type=NotificationType.ADMIN_FIELD_CHANGE,
            title="Modificare la terenuri",
            body=f"{actor.full_name} {action} „{field_name}” la baza {venue.name}.",
            metadata=meta,
            commit=False,
        )
    db.commit()
