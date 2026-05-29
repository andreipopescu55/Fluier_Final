"""
Operatii CRUD pe User. Functiile primesc o sesiune SQLAlchemy si o folosesc;
nu cunosc FastAPI, requesturi sau response-uri.
"""
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.enums import UserRole
from app.schemas.user import UserCreate
from app.core.security import hash_password


def get_by_id(db: Session, user_id: uuid.UUID) -> Optional[User]:
    return db.get(User, user_id)


def get_by_email(db: Session, email: str) -> Optional[User]:
    # email-urile sunt unice, deci .scalar_one_or_none() e potrivit.
    # .lower() pentru ca emailurile sunt case-insensitive la matching.
    stmt = select(User).where(User.email == email.lower())
    return db.execute(stmt).scalar_one_or_none()


def create(db: Session, data: UserCreate, role: UserRole = UserRole.CLIENT) -> User:
    """
    Creeaza un user nou cu parola hashuita.
    NU verifica daca emailul exista deja — endpointul face asta inainte.
    """
    user = User(
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        phone=data.phone,
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)  # re-incarca campurile generate de DB (id, created_at, updated_at)
    return user


def create_oauth_user(
    db: Session,
    *,
    email: str,
    full_name: str,
    oauth_provider: str,
    oauth_id: str,
) -> User:
    """
    Pentru userii care se logheaza prin Google — fara parola, email deja verificat.
    """
    user = User(
        email=email.lower(),
        password_hash=None,
        full_name=full_name,
        oauth_provider=oauth_provider,
        oauth_id=oauth_id,
        email_verified=True,
        role=UserRole.CLIENT,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
