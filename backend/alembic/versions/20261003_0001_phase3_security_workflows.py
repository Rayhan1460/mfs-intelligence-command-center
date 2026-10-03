"""Add authentication, intervention, feedback, audit, and model registry tables.

Revision ID: 20261003_0001
Revises:
Create Date: 2026-10-03
"""
from typing import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20261003_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(512), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("linked_entity_type", sa.String(24)),
        sa.Column("linked_entity_id", sa.String(80)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "role IN ('ADMIN', 'ANALYST', 'REGIONAL_MANAGER', 'MERCHANT', 'AGENT', 'JUDGE')",
            name="ck_users_role",
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=False), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("csrf_token_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("token_hash", name="uq_auth_sessions_token_hash"),
    )
    op.create_index("ix_auth_sessions_user_expires", "auth_sessions", ["user_id", "expires_at"])

    op.create_table(
        "interventions",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("target_type", sa.String(24), nullable=False),
        sa.Column("target_id", sa.String(80), nullable=False),
        sa.Column("capability", sa.String(80), nullable=False),
        sa.Column("recommended_action", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("created_by", sa.Uuid(as_uuid=False), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("approved_by", sa.Uuid(as_uuid=False), sa.ForeignKey("users.id", ondelete="RESTRICT")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("target_type IN ('merchant', 'agent', 'location')", name="ck_interventions_target_type"),
        sa.CheckConstraint("status IN ('PROPOSED', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED')", name="ck_interventions_status"),
    )
    op.create_index("ix_interventions_target_created", "interventions", ["target_type", "target_id", "created_at"])
    op.create_index("ix_interventions_status_created", "interventions", ["status", "created_at"])

    op.create_table(
        "feedback",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("entity_type", sa.String(24), nullable=False),
        sa.Column("entity_id", sa.String(80), nullable=False),
        sa.Column("capability", sa.String(80), nullable=False),
        sa.Column("intelligence_reference", sa.JSON()),
        sa.Column("helpful", sa.Boolean()),
        sa.Column("rating", sa.Integer()),
        sa.Column("comment", sa.Text()),
        sa.Column("created_by", sa.Uuid(as_uuid=False), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("entity_type IN ('merchant', 'agent', 'location')", name="ck_feedback_entity_type"),
        sa.CheckConstraint("helpful IS NOT NULL OR rating IS NOT NULL", name="ck_feedback_has_rating"),
        sa.CheckConstraint("rating IS NULL OR rating BETWEEN 1 AND 5", name="ck_feedback_rating_range"),
    )
    op.create_index("ix_feedback_entity_created", "feedback", ["entity_type", "entity_id", "created_at"])

    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("event_type", sa.String(48), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(as_uuid=False), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("subject_type", sa.String(48)),
        sa.Column("subject_id", sa.String(80)),
        sa.Column("correlation_id", sa.String(64)),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_events_event_created", "audit_events", ["event_type", "created_at"])

    op.create_table(
        "model_versions",
        sa.Column("id", sa.Uuid(as_uuid=False), primary_key=True),
        sa.Column("capability", sa.String(80), nullable=False),
        sa.Column("version", sa.String(80), nullable=False),
        sa.Column("engine_type", sa.String(100), nullable=False),
        sa.Column("serving_mode", sa.String(24), nullable=False),
        sa.Column("horizon", sa.String(64)),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("capability", "version", name="uq_model_versions_capability_version"),
    )


def downgrade() -> None:
    op.drop_table("model_versions")
    op.drop_index("ix_audit_events_event_created", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_index("ix_feedback_entity_created", table_name="feedback")
    op.drop_table("feedback")
    op.drop_index("ix_interventions_status_created", table_name="interventions")
    op.drop_index("ix_interventions_target_created", table_name="interventions")
    op.drop_table("interventions")
    op.drop_index("ix_auth_sessions_user_expires", table_name="auth_sessions")
    op.drop_table("auth_sessions")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")