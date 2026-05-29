"""
CRUD pe Field si PricingRule.
- Field e sub-resursa a unui Venue.
- PricingRule e sub-resursa a unui Field.
"""
import uuid
from typing import Optional, Sequence

from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session

from app.models.field import Field, PricingRule
from app.schemas.field import FieldCreate, FieldUpdate, PricingRuleCreate


# ── Field CRUD ─────────────────────────────────────────────────────────────────
def get_field_by_id(db: Session, field_id: uuid.UUID) -> Optional[Field]:
    return db.get(Field, field_id)


def list_fields_by_venue(db: Session, venue_id: uuid.UUID,
                          only_active: bool = False) -> Sequence[Field]:
    """
    Toate terenurile unui venue.
    only_active=True -> doar is_active=True (folosit pe ruta publica).
    """
    stmt = select(Field).where(Field.venue_id == venue_id)
    if only_active:
        stmt = stmt.where(Field.is_active.is_(True))
    stmt = stmt.order_by(Field.created_at.asc())
    return db.execute(stmt).scalars().all()


def create_field(db: Session, venue_id: uuid.UUID, data: FieldCreate) -> Field:
    field = Field(
        venue_id=venue_id,
        name=data.name,
        sport_type=data.sport_type,
        surface_type=data.surface_type,
        is_indoor=data.is_indoor,
        min_booking_minutes=data.min_booking_minutes,
        slot_duration_minutes=data.slot_duration_minutes,
        is_active=data.is_active,
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


def update_field(db: Session, field: Field, data: FieldUpdate) -> Field:
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(field, key, value)
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


def delete_field(db: Session, field: Field) -> None:
    db.delete(field)
    db.commit()


# ── PricingRule CRUD ───────────────────────────────────────────────────────────
def get_pricing_rule_by_id(db: Session, rule_id: uuid.UUID) -> Optional[PricingRule]:
    return db.get(PricingRule, rule_id)


def list_pricing_rules(db: Session, field_id: uuid.UUID) -> Sequence[PricingRule]:
    """Toate regulile unui teren, sortate pentru afisare predictibila."""
    stmt = (
        select(PricingRule)
        .where(PricingRule.field_id == field_id)
        .order_by(PricingRule.day_of_week.asc(), PricingRule.start_time.asc())
    )
    return db.execute(stmt).scalars().all()


def find_overlapping_rule(
    db: Session,
    field_id: uuid.UUID,
    day_of_week: int,
    start_time,
    end_time,
) -> Optional[PricingRule]:
    """
    Verifica daca exista o regula existenta pe acelasi (field, day) care
    se suprapune cu intervalul [start_time, end_time].

    Conditia de overlap intre 2 intervale [a, b] si [c, d]:
        a < d AND c < b
    (=) regula existenta incepe inainte sa terminam noi AND noi incepem
        inainte sa termine regula existenta.
    """
    stmt = (
        select(PricingRule)
        .where(
            and_(
                PricingRule.field_id == field_id,
                PricingRule.day_of_week == day_of_week,
                PricingRule.start_time < end_time,
                PricingRule.end_time > start_time,
            )
        )
    )
    return db.execute(stmt).scalars().first()


def create_pricing_rule(
    db: Session,
    field_id: uuid.UUID,
    data: PricingRuleCreate,
) -> PricingRule:
    """
    Creeaza o regula. NU verifica overlap-ul aici — endpointul face asta inainte
    si returneaza 409. (Separare: CRUD-ul e dumb, endpointul ia decizii.)
    """
    rule = PricingRule(
        field_id=field_id,
        day_of_week=data.day_of_week,
        start_time=data.start_time,
        end_time=data.end_time,
        price_per_hour=data.price_per_hour,
        currency=data.currency,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def delete_pricing_rule(db: Session, rule: PricingRule) -> None:
    db.delete(rule)
    db.commit()
