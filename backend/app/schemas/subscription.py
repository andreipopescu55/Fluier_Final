import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import SubscriptionPlan, SubscriptionStatus


class SubscribeRequest(BaseModel):
    plan: SubscriptionPlan


class SubscriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    venue_id: uuid.UUID
    plan: SubscriptionPlan
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool
