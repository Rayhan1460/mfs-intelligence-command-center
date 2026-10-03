import json
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.db.models import Feedback, User
from app.db.session import get_db
from app.repositories.artifacts import ArtifactRepository, get_artifact_repository
from app.schemas.workflows import FeedbackCreate, FeedbackResponse
from app.security.audit import record_audit_event
from app.security.dependencies import require_roles
from app.services.intelligence import IntelligenceService

router = APIRouter()
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]
FEEDBACK_REFERENCE_FIELDS = {"source", "as_of", "horizon", "reference_id", "model_version"}


def _response(item: Feedback) -> FeedbackResponse:
    return FeedbackResponse(
        id=item.id,
        entity_type=item.entity_type,
        entity_id=item.entity_id,
        capability=item.capability,
        intelligence_reference=item.intelligence_reference,
        helpful=item.helpful,
        rating=item.rating,
        comment=item.comment,
        created_by=item.created_by,
        created_at=item.created_at.isoformat(),
    )


def _validate_entity(repository: ArtifactRepository, entity_type: str, entity_id: str) -> None:
    service = IntelligenceService(repository)
    if entity_type == "merchant":
        exists = service.merchant_identity(entity_id) is not None
    elif entity_type == "agent":
        exists = service.agent_identity(entity_id) is not None
    else:
        exists = repository.by_id("locations", "location_id", entity_id) is not None
    if not exists:
        raise APIError(404, "entity_not_found", "Feedback entity not found.")


@router.post("", response_model=FeedbackResponse, status_code=201)
def submit_feedback(
    payload: FeedbackCreate,
    request: Request,
    user: User = Depends(require_roles("ADMIN", "ANALYST")),
    session: Session = Depends(get_db),
    repository: ArtifactRepository = Depends(get_artifact_repository),
) -> FeedbackResponse:
    if payload.intelligence_reference:
        if not set(payload.intelligence_reference).issubset(FEEDBACK_REFERENCE_FIELDS):
            raise APIError(422, "invalid_feedback_reference", "The intelligence reference contains unsupported fields.")
        if len(json.dumps(payload.intelligence_reference)) > 1024:
            raise APIError(422, "invalid_feedback_reference", "The intelligence reference is too large.")
    _validate_entity(repository, payload.entity_type, payload.entity_id)
    feedback = Feedback(
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        capability=payload.capability,
        intelligence_reference=payload.intelligence_reference,
        helpful=payload.helpful,
        rating=payload.rating,
        comment=payload.comment,
        created_by=user.id,
    )
    session.add(feedback)
    session.flush()
    record_audit_event(
        session,
        event_type="FEEDBACK_CREATED",
        actor_user_id=user.id,
        subject_type="feedback",
        subject_id=feedback.id,
        correlation_id=getattr(request.state, "correlation_id", None),
        metadata={"entity_type": feedback.entity_type, "capability": feedback.capability},
    )
    session.commit()
    session.refresh(feedback)
    return _response(feedback)


@router.get("")
def list_feedback(
    limit: Limit = 25,
    offset: Offset = 0,
    user: User = Depends(require_roles("ADMIN", "ANALYST", "REGIONAL_MANAGER", "JUDGE", "MERCHANT", "AGENT")),
    session: Session = Depends(get_db),
):
    query = select(Feedback)
    if user.role in {"MERCHANT", "AGENT"}:
        entity_type = user.role.casefold()
        query = query.where(Feedback.entity_type == entity_type, Feedback.entity_id == user.linked_entity_id)
    items = session.scalars(query.order_by(Feedback.created_at.desc(), Feedback.id).offset(offset).limit(limit)).all()
    count_query = select(Feedback.id)
    if user.role in {"MERCHANT", "AGENT"}:
        count_query = count_query.where(
            Feedback.entity_type == user.role.casefold(),
            Feedback.entity_id == user.linked_entity_id,
        )
    total = len(session.scalars(count_query).all())
    return {"items": [_response(item) for item in items], "total": total, "limit": limit, "offset": offset}