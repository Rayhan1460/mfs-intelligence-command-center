from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.repositories.artifacts import ArtifactRepository, get_artifact_repository
from app.services.intelligence import IntelligenceService

router = APIRouter()
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


def service(repository: ArtifactRepository = Depends(get_artifact_repository)) -> IntelligenceService:
    return IntelligenceService(repository)


@router.get("/opportunities")
def location_opportunities(
    limit: Limit = 100,
    offset: Offset = 0,
    district: str | None = None,
    area_type: str | None = None,
    expansion_priority: str | None = None,
    recommended_expansion: str | None = None,
    intelligence: IntelligenceService = Depends(service),
):
    return intelligence.location_opportunities(
        limit=limit,
        offset=offset,
        district=district,
        area_type=area_type,
        expansion_priority=expansion_priority,
        recommended_expansion=recommended_expansion,
    )