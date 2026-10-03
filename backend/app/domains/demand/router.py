from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.repositories.artifacts import ArtifactRepository, get_artifact_repository
from app.security.dependencies import get_current_user, require_roles
from app.services.intelligence import IntelligenceService

DEMAND_READ_ROLES = ("ADMIN", "ANALYST", "REGIONAL_MANAGER", "MERCHANT", "JUDGE")
router = APIRouter(dependencies=[Depends(require_roles(*DEMAND_READ_ROLES))])
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


def service(repository: ArtifactRepository = Depends(get_artifact_repository)) -> IntelligenceService:
    return IntelligenceService(repository)


@router.get("/forecasts")
def demand_forecasts(
    limit: Limit = 100,
    offset: Offset = 0,
    merchant_category: str | None = None,
    intelligence: IntelligenceService = Depends(service),
    user=Depends(get_current_user),
):
    if user.role == "MERCHANT":
        merchant = intelligence.merchant_identity(user.linked_entity_id or "")
        if merchant is None:
            return {
                "source": "synthetic",
                "synthetic_data": True,
                "serving_mode": "batch",
                "horizon": "next_day",
                "forecast_scope": "merchant_category",
                "items": [],
                "total": 0,
                "limit": limit,
                "offset": offset,
            }
        merchant_category = merchant["merchant_category"]
    return intelligence.demand_forecasts(
        limit=limit,
        offset=offset,
        merchant_category=merchant_category,
    )