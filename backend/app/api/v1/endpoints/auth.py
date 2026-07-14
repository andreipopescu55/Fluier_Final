"""
Endpointuri de autentificare: register, login (email + parola), me.
Google OAuth e separat (vezi auth_google.py — adaugat in Pasul 4).
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core import rate_limit
from app.core.security import create_access_token, verify_password, hash_password
from app.crud import user_crud
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserUpdate, PasswordChange
from app.schemas.token import Token


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Inregistrare cu email + parola",
)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    """
    Creeaza un cont client nou.
    Daca emailul e deja folosit, returneaza 409 Conflict.
    """
    existing = user_crud.get_by_email(db, payload.email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Emailul este deja folosit",
        )

    user = user_crud.create(db, payload)
    return user


@router.post(
    "/login",
    response_model=Token,
    summary="Login cu email + parola, returneaza JWT",
)
def login(
    request: Request,
    # OAuth2PasswordRequestForm citeste din application/x-www-form-urlencoded
    # cu campurile "username" si "password". E standardul OAuth2 pe care il
    # foloseste Swagger UI cand apesi "Authorize".
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    # Rate limiting (Redis): dupa 5 incercari esuate pe aceeasi combinatie
    # IP + email, blocam login-ul pana expira fereastra — anti brute-force.
    client_ip = request.client.host if request.client else "necunoscut"
    wait = rate_limit.seconds_until_retry(client_ip, form.username)
    if wait > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Prea multe încercări eșuate. "
                f"Încearcă din nou peste {max(wait // 60, 1)} minute."
            ),
            headers={"Retry-After": str(wait)},
        )

    user = user_crud.get_by_email(db, form.username)

    # Acelasi mesaj generic pentru "user inexistent" si "parola gresita":
    # nu vrem sa-i spunem unui atacator daca emailul exista in DB sau nu.
    auth_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Email sau parola incorecte",
    )

    if user is None or user.password_hash is None:
        # password_hash=None inseamna ca userul s-a inregistrat doar via OAuth
        rate_limit.register_failure(client_ip, form.username)
        raise auth_error
    if not verify_password(form.password, user.password_hash):
        rate_limit.register_failure(client_ip, form.username)
        raise auth_error
    if not user.is_active:
        # Parola era corecta — nu e brute-force, nu numaram incercarea.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cont dezactivat",
        )

    # Login reusit -> incercarile esuate anterioare se uita.
    rate_limit.reset(client_ip, form.username)

    token = create_access_token(user_id=user.id, role=user.role)
    return Token(access_token=token)


@router.get(
    "/me",
    response_model=UserOut,
    summary="Returneaza userul curent (dovada ca tokenul e valid)",
)
def me(current_user: User = Depends(get_current_user)) -> User:
    """Util pentru frontend ca sa stie cine e logat dupa un refresh de pagina."""
    return current_user


@router.patch(
    "/me",
    response_model=UserOut,
    summary="Actualizeaza profilul curent (nume, telefon)",
)
def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Emailul si rolul NU se schimba de aici — emailul e identitatea contului,
    rolul e gestionat doar de super_admin."""
    return user_crud.update_profile(
        db, current_user, full_name=payload.full_name, phone=payload.phone
    )


@router.post(
    "/change-password",
    response_model=UserOut,
    summary="Schimba parola contului curent",
)
def change_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Cere parola curenta (un token furat nu e de ajuns) si respinge conturile
    create doar prin OAuth (nu au parola de schimbat).
    """
    if current_user.password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contul e creat prin OAuth si nu are parola",
        )
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Parola curenta este incorecta",
        )
    return user_crud.set_password(db, current_user, hash_password(payload.new_password))
