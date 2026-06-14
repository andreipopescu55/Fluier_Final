"""
Dependinte FastAPI: sesiune DB + user curent extras din JWT.
"""
import uuid
from typing import Generator, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.user import User
from app.models.enums import UserRole
from app.core.security import decode_access_token, JWTError
from app.crud import user_crud


# tokenUrl spune FastAPI unde se obtine un token — pentru ca Swagger UI sa
# afiseze butonul "Authorize" si sa stie unde sa trimita user/pass.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Varianta care NU arunca 401 daca lipseste tokenul (pentru endpointuri publice
# care personalizeaza raspunsul cand userul e logat — ex: "scorul meu" la rating).
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_db() -> Generator[Session, None, None]:
    """Deschide o sesiune DB pe durata requestului si o inchide la final."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    """
    Decodeaza JWT-ul din header, incarca userul din DB si il returneaza.
    Endpoint-urile care vor cer auth: `current_user: User = Depends(get_current_user)`.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalid sau expirat",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        # JWTError = semnatura/expirare; ValueError = sub nu e UUID
        raise credentials_exception

    user = user_crud.get_by_id(db, user_id)
    if user is None or not user.is_active:
        raise credentials_exception

    return user


def get_current_user_optional(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme_optional),
) -> Optional[User]:
    """
    La fel ca get_current_user, dar returneaza None in loc sa arunce 401 daca
    nu exista token (sau e invalid). Pentru endpointuri publice care vor sa stie
    daca userul curent e logat, fara sa-l forteze sa se autentifice.
    """
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user_id = uuid.UUID(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        return None
    user = user_crud.get_by_id(db, user_id)
    if user is None or not user.is_active:
        return None
    return user


def require_role(*allowed_roles: UserRole):
    """
    Factory pentru o dependinta care verifica rolul userului.
    Folosire intr-un endpoint:
        @router.post(...)
        def admin_only(user: User = Depends(require_role(UserRole.VENUE_ADMIN, UserRole.SUPER_ADMIN))):
            ...
    """
    def _checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Nu ai permisiune pentru aceasta actiune",
            )
        return current_user
    return _checker
