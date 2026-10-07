from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.db.models import Intervention, User
from app.db.session import get_db
from app.repositories.artifacts import ArtifactRepository, get_artifact_repository
from app.schemas.workflows import InterventionCreate, InterventionResponse, InterventionUpdate
from app.security.audit import record_audit_event
from app.security.dependencies import (
    DECIDE_ROLES,
    PROPOSE_ROLES,
    READ_ROLES,
    enforce_entity_scope,
    require_roles,
)
from app.services.intelligence import IntelligenceService

router = APIRouter()
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]
TRANSITIONS = {
    "PROPOSED": {"APPROVED", "REJECTED", "DISMISSED", "DEFERRED"},
    "APPROVED": {"IN_PROGRESS", "DISMISSED", "DEFERRED"},
    "IN_PROGRESS": {"COMPLETED", "DISMISSED", "NO_RESPONSE"},
    "DEFERRED": {"PROPOSED", "APPROVED", "DISMISSED"},
    "REJECTED": set(),
    "COMPLETED": set(),
    "DISMISSED": set(),
    "NO_RESPONSE": {"PROPOSED", "DISMISSED"},
}


def _response(intervention: Intervention) -> InterventionResponse:
    return InterventionResponse(
        id=intervention.id,
        target_type=intervention.target_type,
        target_id=intervention.target_id,
        capability=intervention.capability,
        recommended_action=intervention.recommended_action,
        reason=intervention.reason,
        status=intervention.status,
        created_by=intervention.created_by,
        approved_by=intervention.approved_by,
        created_at=intervention.created_at.isoformat(),
        updated_at=intervention.updated_at.isoformat(),
    )


def _scope(user: User, target_type: str, target_id: str) -> None:
    if user.role in {"MERCHANT", "AGENT"}:
        enforce_entity_scope(user, target_type, target_id)


def _validate_target(
    repository: ArtifactRepository, target_type: str, target_id: str
) -> None:
    service = IntelligenceService(repository)
    if target_type == "merchant":
        exists = service.merchant_identity(target_id) is not None
    elif target_type == "agent":
        exists = service.agent_identity(target_id) is not None
    else:
        exists = repository.by_id("locations", "location_id", target_id) is not None
    if not exists:
        raise APIError(404, "entity_not_found", "Intervention target not found.")


@router.get("/outcomes-summary")
def get_outcomes_summary(
    user: User = Depends(require_roles(*READ_ROLES)),
    session: Session = Depends(get_db),
):
    from sqlalchemy import func
    counts = session.execute(
        select(Intervention.status, func.count(Intervention.id)).group_by(Intervention.status)
    ).all()
    by_status = {s: c for s, c in counts}

    proposed = by_status.get("PROPOSED", 0)
    approved = by_status.get("APPROVED", 0)
    in_progress = by_status.get("IN_PROGRESS", 0)
    completed = by_status.get("COMPLETED", 0)
    rejected = by_status.get("REJECTED", 0)
    deferred = by_status.get("DEFERRED", 0)
    no_response = by_status.get("NO_RESPONSE", 0)
    total = sum(by_status.values())

    decided = approved + rejected
    acceptance_rate = round((approved / decided * 100.0) if decided > 0 else 84.6, 1)
    engaged = completed + in_progress + no_response
    completion_rate = round((completed / engaged * 100.0) if engaged > 0 else 76.2, 1)

    return {
        "synthetic_demo_history": True,
        "label": "SYNTHETIC DEMO HISTORY — illustrative intervention tracking",
        "total_interventions": total,
        "proposed": proposed,
        "approved": approved,
        "in_progress": in_progress,
        "completed": completed,
        "rejected": rejected,
        "deferred": deferred,
        "no_response": no_response,
        "median_review_time_hours": 1.8,
        "action_acceptance_rate_percent": acceptance_rate,
        "completion_rate_percent": completion_rate,
        "outcome_coverage_percent": 91.5,
    }


@router.post("", response_model=InterventionResponse, status_code=201)
def create_intervention(
    payload: InterventionCreate,
    request: Request,
    user: User = Depends(require_roles(*PROPOSE_ROLES)),
    session: Session = Depends(get_db),
    repository: ArtifactRepository = Depends(get_artifact_repository),
) -> InterventionResponse:
    _validate_target(repository, payload.target_type, payload.target_id)
    intervention = Intervention(
        target_type=payload.target_type,
        target_id=payload.target_id,
        capability=payload.capability,
        recommended_action=payload.recommended_action,
        reason=payload.reason,
        status="PROPOSED",
        created_by=user.id,
    )
    session.add(intervention)
    session.flush()
    record_audit_event(
        session,
        event_type="INTERVENTION_CREATED",
        actor_user_id=user.id,
        subject_type="intervention",
        subject_id=intervention.id,
        correlation_id=getattr(request.state, "correlation_id", None),
        metadata={"target_type": intervention.target_type, "status": "PROPOSED"},
    )
    session.commit()
    session.refresh(intervention)
    return _response(intervention)


@router.get("")
def list_interventions(
    limit: Limit = 25,
    offset: Offset = 0,
    user: User = Depends(require_roles(*READ_ROLES)),
    session: Session = Depends(get_db),
):
    query = select(Intervention)
    if user.role == "MERCHANT":
        query = query.where(
            Intervention.target_type == "merchant",
            Intervention.target_id == user.linked_entity_id,
        )
    elif user.role == "AGENT":
        query = query.where(
            Intervention.target_type == "agent",
            Intervention.target_id == user.linked_entity_id,
        )
    items = session.scalars(
        query.order_by(Intervention.created_at.desc(), Intervention.id).offset(offset).limit(limit)
    ).all()
    count_query = select(Intervention.id)
    if user.role == "MERCHANT":
        count_query = count_query.where(Intervention.target_type == "merchant", Intervention.target_id == user.linked_entity_id)
    elif user.role == "AGENT":
        count_query = count_query.where(Intervention.target_type == "agent", Intervention.target_id == user.linked_entity_id)
    total = len(session.scalars(count_query).all())
    return {"items": [_response(item) for item in items], "total": total, "limit": limit, "offset": offset}


@router.get("/{intervention_id}", response_model=InterventionResponse)
def get_intervention(
    intervention_id: str,
    user: User = Depends(require_roles(*READ_ROLES)),
    session: Session = Depends(get_db),
) -> InterventionResponse:
    intervention = session.get(Intervention, intervention_id)
    if intervention is None:
        raise APIError(404, "entity_not_found", "Intervention not found.")
    _scope(user, intervention.target_type, intervention.target_id)
    return _response(intervention)


@router.patch("/{intervention_id}", response_model=InterventionResponse)
def update_intervention(
    intervention_id: str,
    payload: InterventionUpdate,
    request: Request,
    user: User = Depends(require_roles(*DECIDE_ROLES)),
    session: Session = Depends(get_db),
) -> InterventionResponse:
    intervention = session.get(Intervention, intervention_id)
    if intervention is None:
        raise APIError(404, "entity_not_found", "Intervention not found.")
    if payload.status not in TRANSITIONS[intervention.status]:
        raise APIError(422, "invalid_intervention_transition", "The requested status transition is not allowed.")

    old_status = intervention.status
    intervention.status = payload.status
    intervention.updated_at = datetime.now(timezone.utc)
    if payload.status in {"APPROVED", "REJECTED"}:
        intervention.approved_by = user.id
    record_audit_event(
        session,
        event_type="INTERVENTION_STATUS_CHANGED",
        actor_user_id=user.id,
        subject_type="intervention",
        subject_id=intervention.id,
        correlation_id=getattr(request.state, "correlation_id", None),
        metadata={"from_status": old_status, "to_status": payload.status},
    )
    session.commit()
    session.refresh(intervention)
    return _response(intervention)