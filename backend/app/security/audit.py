from typing import Any

from sqlalchemy.orm import Session

from app.db.models import AuditEvent


def record_audit_event(
    session: Session,
    *,
    event_type: str,
    actor_user_id: str | None = None,
    subject_type: str | None = None,
    subject_id: str | None = None,
    correlation_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        event_type=event_type,
        actor_user_id=actor_user_id,
        subject_type=subject_type,
        subject_id=subject_id,
        correlation_id=correlation_id,
        metadata_json=metadata or {},
    )
    session.add(event)
    return event