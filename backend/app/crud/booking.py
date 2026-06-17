"""
CRUD + logica de business pentru Booking (rezervari).

Partea cea mai importanta academic: crearea unei rezervari este SIGURA LA
CONCURENTA. Doi clienti care cer simultan acelasi slot -> doar unul reuseste.
Garantia NU vine din cod, ci din constraint-ul EXCLUDE de pe tabela bookings
(vezi migratia 0001, 'excl_no_double_booking'). Noi doar INSERT-am si, daca
slotul e ocupat, prindem IntegrityError si il traducem intr-un conflict.
"""
import uuid
from datetime import datetime, timezone, timedelta, time
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Sequence
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.field import PricingRule
from app.models.subscription import Payment
from app.models.enums import BookingStatus, BookingSource, PaymentStatus


# Fusul orar al bazelor sportive (aplicatia deserveste Romania). Convertim
# timpii rezervarii in ora locala ca sa stim ce zi a saptamanii e si ce
# regula de pret se aplica (PricingRule are day_of_week + start/end ca 'time').
LOCAL_TZ = ZoneInfo("Europe/Bucharest")

# Cat ramane o rezervare "pending" inainte sa fie considerata expirata
# (folosit la pasul 9: curatarea rezervarilor neplatite).
PENDING_EXPIRY_MINUTES = 15

# Avans: 50% din total, platit cu cardul pentru confirmare; restul la baza.
DEPOSIT_RATIO = Decimal("0.5")

# Anulare permisa doar cu cel putin atatea ore inainte de start (politica client).
CANCELLATION_CUTOFF_HOURS = 24


def compute_deposit(total_price: Decimal) -> Decimal:
    """Avansul = 50% din total, rotunjit la 2 zecimale (in sus la jumatate de ban)."""
    return (Decimal(total_price) * DEPOSIT_RATIO).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def hours_until_start(booking: Booking, now: Optional[datetime] = None) -> float:
    """Cate ore mai sunt pana la inceputul rezervarii (poate fi negativ)."""
    now = now or datetime.now(timezone.utc)
    return (ensure_tz(booking.start_time) - now).total_seconds() / 3600


def owner_can_cancel(booking: Booking, now: Optional[datetime] = None) -> bool:
    """
    Politica pentru client:
      - pending (avans neplatit) -> poate renunta oricand;
      - confirmed -> doar cu cel putin CANCELLATION_CUTOFF_HOURS ore inainte.
    """
    if booking.status == BookingStatus.PENDING:
        return True
    if booking.status == BookingStatus.CONFIRMED:
        return hours_until_start(booking, now) >= CANCELLATION_CUTOFF_HOURS
    return False


def ensure_tz(dt: datetime) -> datetime:
    """
    Daca datetime-ul vine fara fus orar (ex: '2026-06-01T18:00:00' din Swagger),
    il interpretam ca ora locala Romania. Asa testarea ramane prietenoasa.
    """
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=LOCAL_TZ)


# ── Exceptii de domeniu (endpoint-ul le traduce in coduri HTTP) ─────────────────
class BookingConflictError(Exception):
    """Slotul e deja ocupat — constraint-ul EXCLUDE a respins INSERT-ul."""


class NoPricingError(Exception):
    """Nu exista reguli de pret care sa acopere intregul interval cerut."""


# ── 7.1 Calcul pret ─────────────────────────────────────────────────────────────
def compute_booking_price(
    db: Session,
    field_id: uuid.UUID,
    start_time: datetime,
    end_time: datetime,
) -> Decimal:
    """
    Calculeaza pretul total al unei rezervari pe baza PricingRules.

    Cum: parcurgem intervalul [start, end) bucata cu bucata. Pentru fiecare
    moment gasim regula de pret valabila (dupa ziua saptamanii + ora locala) si
    adunam (durata_segment_in_ore * pret_pe_ora). Asa, daca rezervarea trece
    peste o schimbare de tarif (ex: 17:00-18:00 tarif de zi, 18:00-19:00 tarif
    de seara), pretul iese corect, segmentat.

    Ridica NoPricingError daca exista vreun minut neacoperit de nicio regula.
    """
    start_local = start_time.astimezone(LOCAL_TZ)
    end_local = end_time.astimezone(LOCAL_TZ)

    # Toate regulile terenului; le filtram in Python pe zi/ora.
    rules = db.execute(
        select(PricingRule).where(PricingRule.field_id == field_id)
    ).scalars().all()
    if not rules:
        raise NoPricingError("Terenul nu are reguli de pret definite")

    total = Decimal("0")
    cursor = start_local
    # Bucla avanseaza mereu (segment_end > cursor), deci se termina garantat.
    while cursor < end_local:
        dow = cursor.weekday()            # 0=luni ... 6=duminica
        t = cursor.time()

        rule = _find_rule_for(rules, dow, t)
        if rule is None:
            raise NoPricingError(
                f"Nu exista regula de pret care sa acopere {cursor:%A %H:%M}"
            )

        # Sfarsitul regulii. end_time == 00:00 inseamna miezul noptii (24:00),
        # deci se termina la inceputul ZILEI URMATOARE -> asa o rezervare poate
        # trece de miezul noptii (ex: 23:00-01:00), continuand cu regula zilei urmatoare.
        if rule.end_time == time(0, 0):
            rule_end_dt = datetime.combine(cursor.date() + timedelta(days=1), time(0, 0), tzinfo=LOCAL_TZ)
        else:
            rule_end_dt = datetime.combine(cursor.date(), rule.end_time, tzinfo=LOCAL_TZ)
        segment_end = min(end_local, rule_end_dt)

        minutes = Decimal(int((segment_end - cursor).total_seconds() // 60))
        total += rule.price_per_hour * minutes / Decimal(60)

        cursor = segment_end

    # Rotunjire la 2 zecimale (bani).
    return total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _find_rule_for(rules: Sequence[PricingRule], dow: int, t) -> Optional[PricingRule]:
    """
    Prima regula care acopera (ziua, ora): start_time <= t < end_time.
    end_time == 00:00 inseamna miezul noptii (24:00), deci acopera pana la finalul zilei.
    """
    for r in rules:
        if r.day_of_week != dow:
            continue
        if r.end_time == time(0, 0):
            if r.start_time <= t:  # pana la 24:00
                return r
        elif r.start_time <= t < r.end_time:
            return r
    return None


# ── 7.2 Creare rezervare (sigura la concurenta) ─────────────────────────────────
def create_booking(
    db: Session,
    *,
    field_id: uuid.UUID,
    user_id: Optional[uuid.UUID],
    start_time: datetime,
    end_time: datetime,
    total_price: Decimal,
    currency: str = "RON",
    status: BookingStatus = BookingStatus.PENDING,
    booking_source: BookingSource = BookingSource.ONLINE,
    customer_name: Optional[str] = None,
    customer_phone: Optional[str] = None,
    notes: Optional[str] = None,
) -> Booking:
    """
    Insereaza rezervarea. Daca slotul e deja ocupat, constraint-ul EXCLUDE
    'excl_no_double_booking' respinge INSERT-ul -> IntegrityError -> il traducem
    in BookingConflictError (endpoint-ul il transforma in 409).

    NU verificam in prealabil daca slotul e liber: ar introduce o fereastra de
    cursa (TOCTOU). Lasam baza de date sa decida atomic.
    """
    booking = Booking(
        field_id=field_id,
        user_id=user_id,
        start_time=start_time,
        end_time=end_time,
        total_price=total_price,
        currency=currency,
        status=status,
        booking_source=booking_source,
        customer_name=customer_name,
        customer_phone=customer_phone,
        notes=notes,
        deposit_amount=compute_deposit(total_price) if total_price > 0 else None,
    )
    db.add(booking)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if _is_double_booking(exc):
            raise BookingConflictError(
                "Intervalul este deja rezervat pentru acest teren"
            ) from exc
        raise  # alta eroare de integritate — o lasam sa urce
    db.refresh(booking)
    return booking


def _is_double_booking(exc: IntegrityError) -> bool:
    """True daca IntegrityError vine de la constraint-ul nostru EXCLUDE."""
    diag = getattr(exc.orig, "diag", None)
    constraint = getattr(diag, "constraint_name", None)
    if constraint == "excl_no_double_booking":
        return True
    # Fallback pe text, in caz ca diag nu e populat de driver.
    return "excl_no_double_booking" in str(getattr(exc, "orig", exc))


# ── Citire ──────────────────────────────────────────────────────────────────────
def get_booking_by_id(db: Session, booking_id: uuid.UUID) -> Optional[Booking]:
    return db.get(Booking, booking_id)


def list_bookings_by_user(db: Session, user_id: uuid.UUID) -> Sequence[Booking]:
    """Rezervarile unui client, cele mai recente primele."""
    stmt = (
        select(Booking)
        .where(Booking.user_id == user_id)
        .order_by(Booking.start_time.desc())
    )
    return db.execute(stmt).scalars().all()


def list_bookings_for_field(
    db: Session,
    field_id: uuid.UUID,
    range_start: datetime,
    range_end: datetime,
) -> Sequence[Booking]:
    """
    Rezervarile unui teren care se intersecteaza cu [range_start, range_end).
    Folosit de calendarul de admin (pasul 8).
    """
    stmt = (
        select(Booking)
        .where(
            Booking.field_id == field_id,
            Booking.start_time < range_end,
            Booking.end_time > range_start,
        )
        .order_by(Booking.start_time.asc())
    )
    return db.execute(stmt).scalars().all()


# ── Expirare rezervari neplatite (pasul 9) ──────────────────────────────────────
def expire_stale_pending_bookings(
    db: Session,
    older_than_minutes: int = PENDING_EXPIRY_MINUTES,
) -> int:
    """
    Anuleaza rezervarile ramase 'pending' mai mult de `older_than_minutes`.

    Scenariu: clientul incepe o rezervare (status=pending, asteapta plata) dar
    nu finalizeaza. Slotul ar ramane blocat la nesfarsit. Aceasta functie le
    trece pe 'cancelled' -> EXCLUDE nu se mai aplica -> slotul redevine liber.

    In productie ar fi rulata periodic (cron / Celery beat). La pasul 9 o testam.
    Returneaza numarul de rezervari expirate.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=older_than_minutes)
    stmt = select(Booking).where(
        Booking.status == BookingStatus.PENDING,
        Booking.created_at < cutoff,
    )
    stale = db.execute(stmt).scalars().all()
    now = datetime.now(timezone.utc)
    for b in stale:
        b.status = BookingStatus.CANCELLED
        b.cancelled_at = now
    db.commit()
    return len(stale)


# ── Plata avansului (confirmare) ────────────────────────────────────────────────
def pay_deposit(db: Session, booking: Booking) -> Booking:
    """
    Inregistreaza plata avansului (MOCK — fara card real, ca abonamentul) si
    confirma rezervarea. Cream un Payment 'succeeded' legat de rezervare; restul
    de 50% ramane de incasat la baza sportiva.

    Inlocuirea cu Stripe real: aici am crea un PaymentIntent si am confirma
    rezervarea abia dupa webhook-ul de succes.
    """
    now = datetime.now(timezone.utc)
    amount = booking.deposit_amount if booking.deposit_amount is not None else compute_deposit(booking.total_price)
    payment = Payment(
        booking_id=booking.id,
        amount=amount,
        currency=booking.currency,
        status=PaymentStatus.SUCCEEDED,
        paid_at=now,
        stripe_payment_intent_id=f"mock_{uuid.uuid4().hex}",
    )
    db.add(payment)
    booking.status = BookingStatus.CONFIRMED
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


# ── Anulare ──────────────────────────────────────────────────────────────────────
def cancel_booking(
    db: Session,
    booking: Booking,
    cancelled_by_id: Optional[uuid.UUID],
) -> Booking:
    """
    Marcheaza rezervarea ca 'cancelled'. Pentru ca EXCLUDE se aplica doar pe
    status IN ('pending','confirmed'), anularea ELIBEREAZA automat slotul.
    Daca exista un avans incasat (Payment 'succeeded'), il marcam 'refunded'.
    """
    now = datetime.now(timezone.utc)
    booking.status = BookingStatus.CANCELLED
    booking.cancelled_at = now
    booking.cancelled_by_id = cancelled_by_id
    db.add(booking)

    # Refund avans: orice plata reusita pe aceasta rezervare devine 'refunded'.
    paid = db.execute(
        select(Payment).where(
            Payment.booking_id == booking.id,
            Payment.status == PaymentStatus.SUCCEEDED,
        )
    ).scalars().all()
    for p in paid:
        p.status = PaymentStatus.REFUNDED
        db.add(p)

    db.commit()
    db.refresh(booking)
    return booking
