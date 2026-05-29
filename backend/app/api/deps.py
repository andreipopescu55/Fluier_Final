"""
Dependinte FastAPI: sesiune DB + user curent extras din JWT.
"""
import uuid
from typing import Generator

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
