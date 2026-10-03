from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.db.session import is_database_ready
from app.schemas.health import HealthResponse, ReadinessResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    responses={503: {"description": "A required dependency is unavailable"}},
)
def readiness_check() -> ReadinessResponse | JSONResponse:
    if not is_database_ready():
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "dependencies": {"database": "unavailable"},
            },
        )

    return ReadinessResponse(
        status="ready",
        dependencies={"database": "available"},
    )