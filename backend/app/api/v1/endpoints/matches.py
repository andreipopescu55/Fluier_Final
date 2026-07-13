"""
Endpoint-uri pentru Find Party (meciuri deschise).

Flux:
  GET    /matches                       -> lista meciuri deschise (filtre)
  GET    /matches/me                    -> meciurile mele (organizate / inscris)
  GET    /matches/by-booking/{id}       -> meciul atasat unei rezervari (sau 404)
  GET    /matches/{id}                  -> detaliu + roster (+ cereri, daca esti organizator)
  POST   /matches                       -> deschide un meci dintr-o rezervare a mea
  POST   /matches/{id}/join             -> cerere de alaturare
  DELETE /matches/{id}/leave            -> iesi din meci
  POST   /matches/{id}/participants/{uid}/approve -> organizatorul aproba (sigur la concurenta)
  POST   /matches/{id}/participants/{uid}/reject  -> organizatorul respinge / scoate
  DELETE /matches/{id}                  -> organizatorul anuleaza
"""
import uuid
from datetime import datetime, timezone, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, get_current_user_optional
from app.crud import booking_crud, match_crud, notification_crud
from app.crud.match import (
    MatchError, MatchFullError, AlreadyParticipantError, NotParticipantError,
)
from app.models.user import User
from app.models.match import Match
from app.models.enums import MatchStatus, MatchSkillLevel, ParticipantStatus, BookingStatus
from app.schemas.match import MatchCreate, MatchListItem, MatchDetail, ParticipantOut


router = APIRouter(prefix="/matches", tags=["matches"])


# ── Serializare ───────────────────────────────────────────────────────────────
def _participant_out(p) -> ParticipantOut:
    return ParticipantOut(
        user_id=p.user_id,
        full_name=p.user.full_name if p.user else "—",
        status=p.status,
        created_at=p.created_at,
    )


def _base_fields(match: Match, current_user: Optional[User]) -> dict:
    booking = match.booking
    field = booking.field
    venue = field.venue
    approved = [p for p in match.participants if p.status == ParticipantStatus.APPROVED]
    spots_taken = len(approved) + 1  # + organizator
    my_status = None
    is_organizer = False
    if current_user is not None:
        is_organizer = match.organizer_id == current_user.id
        mine = next((p for p in match.participants if p.user_id == current_user.id), None)
        my_status = mine.status if mine else None
    return dict(
        id=match.id,
        booking_id=match.booking_id,
        status=match.status,
        skill_level=match.skill_level,
        total_spots=match.total_spots,
        spots_taken=spots_taken,
        spots_left=max(match.total_spots - spots_taken, 0),
        note=match.note,
        price_per_player=match.price_per_player,
        start_time=booking.start_time,
        end_time=booking.end_time,
        venue_name=venue.name,
        venue_slug=venue.slug,
        city=venue.city,
        field_name=field.name,
        sport_type=field.sport_type.value,
        organizer_name=match.organizer.full_name if match.organizer else "—",
        is_organizer=is_organizer,
        my_status=my_status,
    )


def _to_list_item(match: Match, current_user: Optional[User]) -> MatchListItem:
    return MatchListItem(**_base_fields(match, current_user))


def _to_detail(match: Match, current_user: Optional[User]) -> MatchDetail:
    fields = _base_fields(match, current_user)
    roster = [
        _participant_out(p) for p in match.participants
        if p.status == ParticipantStatus.APPROVED
    ]
    pending = []
    if fields["is_organizer"]:
        pending = [
            _participant_out(p) for p in match.participants
            if p.status == ParticipantStatus.REQUESTED
        ]
    return MatchDetail(
        **fields,
        organizer_id=match.organizer_id,
        field_id=match.booking.field_id,
        participants=roster,
        pending_requests=pending,
    )


# ── Listare ───────────────────────────────────────────────────────────────────
@router.get("", response_model=list[MatchListItem], summary="Lista meciurilor deschise")
def list_matches(
    city: Optional[str] = Query(None),
    sport: Optional[str] = Query(None),
    skill: Optional[MatchSkillLevel] = Query(None),
    on_date: Optional[date] = Query(None, alias="date"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    matches = match_crud.list_open_matches(db, city=city, sport=sport, skill=skill, on_date=on_date)
    return [_to_list_item(m, current_user) for m in matches]


@router.get("/me", response_model=list[MatchListItem], summary="Meciurile mele")
def list_my_matches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matches = match_crud.list_matches_for_user(db, current_user.id)
    return [_to_list_item(m, current_user) for m in matches]


@router.get("/by-booking/{booking_id}", response_model=MatchDetail, summary="Meciul unei rezervari")
def get_match_for_booking(
    booking_id: uuid.UUID,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    match = match_crud.get_match_by_booking(db, booking_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Aceasta rezervare nu are un meci deschis")
    return _to_detail(match, current_user)


@router.get("/{match_id}", response_model=MatchDetail, summary="Detaliile unui meci")
def get_match(
    match_id: uuid.UUID,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    match = match_crud.get_match_by_id(db, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Meci inexistent")
    return _to_detail(match, current_user)


# ── Creare ────────────────────────────────────────────────────────────────────
@router.post("", response_model=MatchDetail, status_code=status.HTTP_201_CREATED,
             summary="Deschide un meci dintr-o rezervare")
def create_match(
    payload: MatchCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    booking = booking_crud.get_booking_by_id(db, payload.booking_id)
    if booking is None:
        raise HTTPException(status_code=404, detail="Rezervare inexistenta")
    if booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Poti deschide meci doar pentru rezervarile tale")
    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(status_code=409, detail="Rezervarea este anulata")
    if booking.start_time <= datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="Nu poti deschide meci pentru un interval trecut")
    if match_crud.get_match_by_booking(db, booking.id) is not None:
        raise HTTPException(status_code=409, detail="Exista deja un meci pentru aceasta rezervare")

    match = match_crud.create_match(
        db,
        booking=booking,
        organizer_id=current_user.id,
        total_spots=payload.total_spots,
        skill_level=payload.skill_level,
        note=payload.note,
        price_per_player=payload.price_per_player,
    )
    return _to_detail(match, current_user)


# ── Alaturare / iesire (jucator) ────────────────────────────────────────────────
@router.post("/{match_id}/join", response_model=MatchDetail, summary="Cere sa te alaturi")
def join_match(
    match_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    match = match_crud.get_match_by_id(db, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Meci inexistent")
    if match.organizer_id == current_user.id:
        raise HTTPException(status_code=409, detail="Esti organizatorul acestui meci")
    if match.status != MatchStatus.OPEN:
        raise HTTPException(status_code=409, detail="Meciul nu mai primeste cereri")
    if match.booking.start_time <= datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="Meciul a inceput deja")

    try:
        match_crud.request_join(db, match=match, user_id=current_user.id)
    except AlreadyParticipantError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    # Inbox: organizatorul afla ca are o cerere noua de aprobat.
    notification_crud.notify_join_request(db, match, requester=current_user)

    return _to_detail(match_crud.get_match_by_id(db, match_id), current_user)


@router.delete("/{match_id}/leave", response_model=MatchDetail, summary="Iesi din meci")
def leave_match(
    match_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    match = match_crud.get_match_by_id(db, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Meci inexistent")
    # Retinem starea DINAINTE de iesire, ca mesajul catre organizator sa fie
    # corect: "a iesit din meci" (era aprobat) vs "si-a retras cererea".
    mine = next((p for p in match.participants if p.user_id == current_user.id), None)
    was_approved = mine is not None and mine.status == ParticipantStatus.APPROVED
    try:
        match_crud.leave_match(db, match=match, user_id=current_user.id)
    except NotParticipantError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    # Inbox: organizatorul afla ca cineva a iesit / si-a retras cererea.
    notification_crud.notify_player_left(db, match, player=current_user, was_approved=was_approved)

    return _to_detail(match_crud.get_match_by_id(db, match_id), current_user)


# ── Aprobare / respingere (organizator) ──────────────────────────────────────────
def _require_organizer(match: Match, current_user: User) -> None:
    if match.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Doar organizatorul poate face asta")


@router.post("/{match_id}/participants/{participant_user_id}/approve",
             response_model=MatchDetail, summary="Aproba un jucator")
def approve(
    match_id: uuid.UUID,
    participant_user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    match = match_crud.get_match_by_id(db, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Meci inexistent")
    _require_organizer(match, current_user)
    try:
        match_crud.approve_participant(db, match_id=match_id, participant_user_id=participant_user_id)
    except MatchFullError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except NotParticipantError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except MatchError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    # Inbox: jucatorul afla ca a fost acceptat.
    notification_crud.notify_request_approved(db, match, player_id=participant_user_id)

    return _to_detail(match_crud.get_match_by_id(db, match_id), current_user)


@router.post("/{match_id}/participants/{participant_user_id}/reject",
             response_model=MatchDetail, summary="Respinge / scoate un jucator")
def reject(
    match_id: uuid.UUID,
    participant_user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    match = match_crud.get_match_by_id(db, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Meci inexistent")
    _require_organizer(match, current_user)
    # Starea dinainte decide mesajul: "scos din meci" (aprobat) vs "cerere respinsa".
    target = next((p for p in match.participants if p.user_id == participant_user_id), None)
    was_approved = target is not None and target.status == ParticipantStatus.APPROVED
    try:
        match_crud.reject_participant(db, match=match, participant_user_id=participant_user_id)
    except NotParticipantError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    # Inbox: jucatorul afla ca a fost respins / scos.
    notification_crud.notify_request_rejected(
        db, match, player_id=participant_user_id, was_approved=was_approved
    )

    return _to_detail(match_crud.get_match_by_id(db, match_id), current_user)


@router.delete("/{match_id}", response_model=MatchDetail, summary="Anuleaza meciul")
def cancel(
    match_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    match = match_crud.get_match_by_id(db, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Meci inexistent")
    _require_organizer(match, current_user)
    # Cine trebuie anuntat: toti cei cu cerere activa (aprobati + in asteptare).
    affected_ids = [
        p.user_id for p in match.participants
        if p.status in (ParticipantStatus.APPROVED, ParticipantStatus.REQUESTED)
    ]
    match_crud.cancel_match(db, match=match)

    # Inbox: jucatorii afla ca meciul a fost anulat.
    notification_crud.notify_match_cancelled(db, match, participant_ids=affected_ids)

    return _to_detail(match_crud.get_match_by_id(db, match_id), current_user)
