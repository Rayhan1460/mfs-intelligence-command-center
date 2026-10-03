from datetime import date
from typing import Annotated, Literal

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
def list_agents(
    limit: Limit = 25,
    offset: Offset = 0,
    location_id: str | None = None,
    district: str | None = None,
    agent_type: str | None = None,
    status: str | None = None,
    intelligence: IntelligenceService = Depends(service),
):
    return intelligence.agents(
        limit=limit,
        offset=offset,
        location_id=location_id,
        district=district,
        agent_type=agent_type,
        status=status,
    )


@router.get("/{agent_id}/overview")
def agent_overview(agent_id: str, intelligence: IntelligenceService = Depends(service)):
    result = intelligence.agent_overview(agent_id)
    if result is None:
        raise APIError(404, "entity_not_found", "Agent not found.")
    return result


@router.get("/{agent_id}/liquidity-forecast")
def agent_liquidity_forecast(
    agent_id: str,
    horizon: Literal["next_day"] = "next_day",
    target_date: date | None = None,
    intelligence: IntelligenceService = Depends(service),
):
    result = intelligence.liquidity_forecast(agent_id, target_date, horizon=horizon)
    if result is None:
        raise APIError(404, "entity_not_found", "Agent not found.")
    return result


@router.get("/{agent_id}/performance")
def agent_performance(agent_id: str, intelligence: IntelligenceService = Depends(service)):
    result = intelligence.agent_performance(agent_id)
    if result is None:
        raise APIError(404, "entity_not_found", "Agent not found.")
    return result


@router.get("/{agent_id}/anomalies")
def agent_anomalies(agent_id: str, intelligence: IntelligenceService = Depends(service)):
    result = intelligence.agent_anomalies(agent_id)
    if result is None:
        raise APIError(404, "entity_not_found", "Agent not found.")
    return result