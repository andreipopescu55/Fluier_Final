from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, venues, fields

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(venues.router)
api_router.include_router(fields.venues_fields_router)
api_router.include_router(fields.fields_router)
api_router.include_router(fields.pricing_router)
