"""
Endpoint-uri pentru inbox-ul de notificari (orice rol autentificat).

  GET  /notifications               -> notificarile userului curent (noi + istoric)
  GET  /notifications/unread-count  -> cate necitite are (pentru badge-ul din navbar)
  POST /notifications/{id}/read     -> citita -> trece in istoric (is_read=true)
  POST /notifications/read-all      -> toate citite -> istoric

Inbox-ul are doua zone: "Noi" (necitite) si "Istoric" (citite). Citirea NU
sterge mesajul, doar il muta in istoric. Fiecare user isi vede DOAR
notificarile lui — nu exista acces incrucisat, nici macar pentru super_admin.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.crud import notification_crud
from app.models.user import User
from app.schemas.notification import NotificationOut, UnreadCountOut


router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut], summary="Notificarile mele")
def list_notifications(
    only_unread: bool = Query(False, description="Doar necitite"),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return notification_crud.list_for_user(
        db, current_user.id, only_unread=only_unread, limit=limit
    )


@router.get("/unread-count", response_model=UnreadCountOut, summary="Cate necitite am")
def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return UnreadCountOut(unread=notification_crud.unread_count(db, current_user.id))


@router.post("/read-all", response_model=UnreadCountOut,
             summary="Marcheaza tot ca citit (muta tot in istoric)")
def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification_crud.mark_all_read(db, current_user.id)
    return UnreadCountOut(unread=0)


@router.post("/{notification_id}/read", response_model=NotificationOut,
             summary="Marcheaza o notificare ca citita (trece in istoric)")
def mark_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = notification_crud.get_by_id(db, notification_id)
    if notif is None or notif.user_id != current_user.id:
        # 404 si pentru notificarile altora — nu confirmam ca exista.
        raise HTTPException(status_code=404, detail="Notificare inexistenta")
    return notification_crud.mark_read(db, notif)
