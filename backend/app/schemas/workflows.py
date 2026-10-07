from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


EntityType = Literal["merchant", "agent", "location"]
InterventionStatus = Literal[
    "PROPOSED",
    "APPROVED",
    "REJECTED",
    "DEFERRED",
    "IN_PROGRESS",
    "COMPLETED",
    "DISMISSED",
    "NO_RESPONSE",
]


class InterventionCreate(BaseModel):
    target_type: EntityType
    target_id: str = Field(min_length=1, max_length=80)
    capability: str = Field(min_length=1, max_length=80)
    recommended_action: str = Field(min_length=1, max_length=2000)
    reason: str = Field(min_length=1, max_length=4000)
    owner: str | None = Field(default=None, max_length=80)
    due_date: str | None = Field(default=None, max_length=32)
    expected_impact: str | None = Field(default=None, max_length=2000)


class InterventionUpdate(BaseModel):
    status: InterventionStatus
    owner: str | None = Field(default=None, max_length=80)
    due_date: str | None = Field(default=None, max_length=32)
    expected_impact: str | None = Field(default=None, max_length=2000)
    observed_outcome: str | None = Field(default=None, max_length=2000)
    feedback: str | None = Field(default=None, max_length=2000)


class InterventionResponse(BaseModel):
    id: str
    target_type: str
    target_id: str
    capability: str
    recommended_action: str
    reason: str
    status: str
    created_by: str
    approved_by: str | None
    owner: str | None = None
    due_date: str | None = None
    expected_impact: str | None = None
    observed_outcome: str | None = None
    feedback: str | None = None
    completion_timestamp: str | None = None
    created_at: str
    updated_at: str


class OutcomesSummaryResponse(BaseModel):
    synthetic_demo_history: bool = True
    label: str = "SYNTHETIC DEMO HISTORY — illustrative intervention tracking"
    total_interventions: int
    proposed: int
    approved: int
    in_progress: int
    completed: int
    rejected: int
    deferred: int
    no_response: int
    median_review_time_hours: float
    action_acceptance_rate_percent: float
    completion_rate_percent: float
    outcome_coverage_percent: float


class FeedbackCreate(BaseModel):
    entity_type: EntityType
    entity_id: str = Field(min_length=1, max_length=80)
    capability: str = Field(min_length=1, max_length=80)
    intelligence_reference: dict[str, Any] | None = None
    helpful: bool | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def has_feedback_value(self):
        if self.helpful is None and self.rating is None and not self.comment:
            raise ValueError("Provide helpful, rating, or comment feedback.")
        return self


class FeedbackResponse(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    capability: str
    intelligence_reference: dict[str, Any] | None
    helpful: bool | None
    rating: int | None
    comment: str | None
    created_by: str
    created_at: str