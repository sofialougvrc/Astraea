from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import get_settings


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="Full-stack API scaffold for Astraea stratigraphic reconciliation, anomaly detection, ST-GNN link prediction, and Bayesian chronology simulation.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix=settings.api_prefix)


@app.get("/")
def root() -> dict:
    return {
        "name": "Astraea",
        "message": "Stratigraphic Reconciliation & Anomaly Engine API",
        "docs": "/docs",
    }
