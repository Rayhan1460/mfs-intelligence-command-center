from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.errors import APIError
from app.repositories.artifacts import ArtifactRepository, get_artifact_repository
from app.services.intelligence import IntelligenceService

router = APIRouter()
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


def service(repository: ArtifactRepository = Depends(get_artifact_repository)) -> IntelligenceService:
    return IntelligenceService(repository)


@router.get("")
def list_merchants(
    limit: Limit = 25,
    offset: Offset = 0,
    merchant_category: str | None = None,
    business_size: str | None = None,
    location_id: str | None = None,
    district: str | None = None,
    status: str | None = None,
    intelligence: IntelligenceService = Depends(service),
):
    return intelligence.merchants(
        limit=limit,
        offset=offset,
        merchant_category=merchant_category,
        business_size=business_size,
        location_id=location_id,
        district=district,
        status=status,
    )


@router.get("/{merchant_id}/overview")
def merchant_overview(merchant_id: str, intelligence: IntelligenceService = Depends(service)):
    result = intelligence.merchant_overview(merchant_id)
    if result is None:
        raise APIError(404, "entity_not_found", "Merchant not found.")
    return result


@router.get("/{merchant_id}/forecast")
def merchant_forecast(merchant_id: str, intelligence: IntelligenceService = Depends(service)):
    result = intelligence.merchant_forecast(merchant_id)
    if result is None:
        raise APIError(404, "entity_not_found", "Merchant not found.")
    return result


@router.get("/{merchant_id}/churn-risk")
def merchant_churn(merchant_id: str, intelligence: IntelligenceService = Depends(service)):
    result = intelligence.churn_risk(merchant_id)
    if result is None:
        raise APIError(404, "entity_not_found", "Merchant not found.")
    return result


@router.get("/{merchant_id}/benchmark")
def merchant_benchmark(merchant_id: str, intelligence: IntelligenceService = Depends(service)):
    result = intelligence.merchant_benchmark(merchant_id)
    if result is None:
        raise APIError(404, "entity_not_found", "Merchant not found.")
    return result


@router.get("/{merchant_id}/recommendations")
def merchant_recommendation(merchant_id: str, intelligence: IntelligenceService = Depends(service)):
    result = intelligence.merchant_recommendation(merchant_id)
    if result is None:
        raise APIError(404, "entity_not_found", "Merchant not found.")
    return result