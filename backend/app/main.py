import logging
from uuid import uuid4

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import APIError
from app.repositories.artifacts import ArtifactUnavailableError

logger = logging.getLogger(__name__)
app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    request.state.correlation_id = str(uuid4())
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = request.state.correlation_id
    return response


def _error_response(
    request: Request, status_code: int, code: str, message: str, safe_details=None
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "code": code,
            "message": message,
            "correlation_id": getattr(request.state, "correlation_id", "unavailable"),
            "safe_details": safe_details or {},
        },
    )


@app.exception_handler(APIError)
async def api_error_handler(request: Request, error: APIError) -> JSONResponse:
    return _error_response(request, error.status_code, error.code, error.message)


@app.exception_handler(ArtifactUnavailableError)
async def artifact_error_handler(
    request: Request, error: ArtifactUnavailableError
) -> JSONResponse:
    logger.warning("Runtime artifact unavailable (%s)", type(error).__name__)
    return _error_response(
        request,
        404,
        "intelligence_not_available",
        "The requested intelligence artifact is unavailable.",
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    request: Request, error: RequestValidationError
) -> JSONResponse:
    fields = [
        ".".join(str(part) for part in item.get("loc", ()))
        for item in error.errors()
    ]
    return _error_response(
        request,
        422,
        "validation_error",
        "The request contains invalid parameters.",
        {"fields": fields},
    )


@app.exception_handler(Exception)
async def internal_error_handler(request: Request, error: Exception) -> JSONResponse:
    logger.error("Unhandled API exception (%s)", type(error).__name__)
    return _error_response(
        request,
        500,
        "internal_error",
        "The request could not be completed.",
    )


app.include_router(api_router, prefix="/api/v1")