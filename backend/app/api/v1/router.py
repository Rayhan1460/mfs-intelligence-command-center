from fastapi import APIRouter

from app.api.v1.endpoints.health import router as health_router
from app.domains.agents.router import router as agents_router
from app.domains.demand.router import router as demand_router
from app.domains.locations.router import router as locations_router
from app.domains.merchants.router import router as merchants_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(demand_router, prefix="/demand", tags=["demand"])
api_router.include_router(merchants_router, prefix="/merchants", tags=["merchants"])
api_router.include_router(agents_router, prefix="/agents", tags=["agents"])
api_router.include_router(locations_router, prefix="/locations", tags=["locations"])