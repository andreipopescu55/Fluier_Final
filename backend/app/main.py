from fastapi import FastAPI

from app.api.v1.router import api_router
from app.core.config import settings


# Schema bazei de date e gestionata de Alembic (vezi alembic/versions/).
# La pornirea aplicatiei nu mai cream/modificam tabele automat.
# Pentru a aplica migrarile: `alembic upgrade head`.
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
)

app.include_router(api_router, prefix="/api/v1")
