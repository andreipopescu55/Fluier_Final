import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import NotificationType


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: NotificationType
    title: str
    body: Optional[str]
    is_read: bool
    # In DB coloana se numeste "metadata" (atributul Python e metadata_,
    # pentru ca "metadata" e rezervat in SQLAlchemy). Expunem "metadata" in API.
    metadata: Optional[dict] = Field(None, validation_alias="metadata_")
    created_at: datetime


class UnreadCountOut(BaseModel):
    unread: int
