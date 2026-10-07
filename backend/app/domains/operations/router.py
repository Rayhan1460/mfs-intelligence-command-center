from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.session import get_db
from app.domains.operations.service import OperationsService
from app.repositories.artifacts import ArtifactRepository, get_artifact_repository
from app.schemas.operations import (
    DailyPrioritiesResponse,
    MorningBriefing,
    ProductionDataRequirement,
)
from app.security.dependencies import READ_ROLES, get_current_user, require_roles

router = APIRouter(dependencies=[Depends(require_roles(*READ_ROLES))])
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


def get_operations_service(
    repository: ArtifactRepository = Depends(get_artifact_repository),
) -> OperationsService:
    return OperationsService(repository)


@router.get("/daily-priorities", response_model=DailyPrioritiesResponse)
def get_daily_priorities(
    limit: Limit = 20,
    offset: Offset = 0,
    entity_type: str | None = Query(None, description="Filter by 'agent' or 'merchant'"),
    priority: str | None = Query(None, description="Filter by 'HIGH', 'MEDIUM', or 'LOW'"),
    district: str | None = Query(None, description="Filter by district name"),
    service: OperationsService = Depends(get_operations_service),
    session: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DailyPrioritiesResponse:
    # Role scoping for linked merchant or agent accounts
    scoped_entity_type = entity_type
    if user.role == "MERCHANT":
        scoped_entity_type = "merchant"
    elif user.role == "AGENT":
        scoped_entity_type = "agent"

    response = service.daily_priorities(
        limit=limit,
        offset=offset,
        entity_type=scoped_entity_type,
        priority=priority,
        district=district,
        session=session,
    )

    if user.role in {"MERCHANT", "AGENT"} and user.linked_entity_id:
        scoped_items = [
            item for item in response.items if item.entity_id == user.linked_entity_id
        ]
        return DailyPrioritiesResponse(
            source=response.source,
            synthetic_data=response.synthetic_data,
            serving_mode=response.serving_mode,
            scoring_formula=response.scoring_formula,
            briefing=response.briefing,
            items=scoped_items,
            total=len(scoped_items),
            limit=limit,
            offset=0,
        )

    return response


@router.get("/briefing", response_model=MorningBriefing)
def get_morning_briefing(
    service: OperationsService = Depends(get_operations_service),
    session: Session = Depends(get_db),
) -> MorningBriefing:
    candidates = service.get_candidate_priorities(session)
    return service.compute_morning_briefing(candidates)


@router.get("/production-data-requirements", response_model=list[ProductionDataRequirement])
def get_production_data_requirements() -> list[ProductionDataRequirement]:
    return OperationsService.get_production_data_requirements()
