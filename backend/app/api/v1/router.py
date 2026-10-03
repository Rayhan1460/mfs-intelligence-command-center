from fastapi import APIRouter

from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.auth import identity_router, router as auth_router
from app.domains.agents.router import router as agents_router
from app.domains.assistant.router import router as assistant_router
from app.domains.demand.router import router as demand_router
from app.domains.feedback.router import router as feedback_router
from app.domains.interventions.router import router as interventions_router
from app.domains.locations.router import router as locations_router
from app.domains.merchants.router import router as merchants_router
from app.domains.registry.router import router as registry_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(auth_router, prefix="/auth", tags=["authentication"])
api_router.include_router(identity_router, tags=["authentication"])
api_router.include_router(demand_router, prefix="/demand", tags=["demand"])
api_router.include_router(merchants_router, prefix="/merchants", tags=["merchants"])
api_router.include_router(agents_router, prefix="/agents", tags=["agents"])
api_router.include_router(locations_router, prefix="/locations", tags=["locations"])
api_router.include_router(interventions_router, prefix="/interventions", tags=["interventions"])
api_router.include_router(feedback_router, prefix="/feedback", tags=["feedback"])
api_router.include_router(registry_router, prefix="/admin", tags=["model registry"])
api_router.include_router(assistant_router, prefix="/assistant", tags=["ai assistant"])