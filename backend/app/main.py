from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.api.v1.router import api_router
from app.core.config import settings
from app.db.init_db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tot ce e inainte de "yield" ruleaza la pornirea serverului
    init_db()
    yield
    # Tot ce e dupa "yield" ruleaza la oprirea serverului (Ctrl+C)
    # Momentan nu avem nimic de facut la oprire


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

app.include_router(api_router, prefix="/api/v1")
