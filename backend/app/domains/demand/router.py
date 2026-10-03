from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.repositories.artifacts import ArtifactRepository, get_artifact_repository
from app.services.intelligence import IntelligenceService

router = APIRouter()
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
):
    return intelligence.demand_forecasts(
        limit=limit,
        offset=offset,
        merchant_category=merchant_category,
    )