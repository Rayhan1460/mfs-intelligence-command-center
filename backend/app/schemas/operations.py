from typing import Any, Literal
from pydantic import BaseModel, Field


class PriorityActionItem(BaseModel):
    priority_rank: int = Field(..., description="Deterministic priority rank (1 = highest)")
    priority_score: float = Field(..., description="Explainable composite priority score (0-100)")
    priority_level: Literal["HIGH", "MEDIUM", "LOW"] = Field(..., description="Operational severity band")
    entity_id: str = Field(..., description="Canonical agent or merchant ID")
    entity_type: Literal["agent", "merchant"] = Field(..., description="Type of MFS network entity")
    entity_name_or_category: str = Field(..., description="Category or operational profile label")
    district: str = Field(..., description="District where entity operates")
    location_id: str | None = Field(None, description="Location identifier")
    reason: str = Field(..., description="Why this entity was flagged for operations today")
    evidence: str = Field(..., description="Empirical signal or feature threshold from validated models")
    recommended_action: str = Field(..., description="Concrete operational action for MFS team")
    expected_value_label: str = Field(..., description="Expected business impact proxy")
    expected_value_score: float = Field(default=0.0, description="Synthetic expected value impact score")
    confidence_label: str = Field(..., description="Evidence quality and model confidence label")
    risk_or_opportunity: Literal["RISK", "GROWTH_OPPORTUNITY"] = Field(
        default="RISK", description="Target problem type"
    )
    suggested_owner: str = Field(
        default="Field Team", description="Operational group responsible (e.g. Agent Operations, Field Team)"
    )
    suggested_demo_sla: str = Field(
        default="24h — Next business day", description="Suggested demo response SLA (not actual upay SLA)"
    )
    source_model_or_rule: str = Field(
        default="Validated Batch Intelligence", description="Underlying algorithm or rule"
    )
    model_version: str | None = Field(default="2.0", description="Model or engine version")
    source_modules: list[str] = Field(..., description="Originating intelligence domain modules")
    review_status: str = Field(default="PENDING_REVIEW", description="Current human review workflow state")
    intervention_id: str | None = Field(None, description="Linked intervention ID if proposed/active")
    future_data_required: list[str] = Field(
        default_factory=list,
        description="Data not in synthetic batch that would be required in live production",
    )


class MorningBriefing(BaseModel):
    as_of_date: str = Field(..., description="Effective batch intelligence date")
    total_actions_flagged: int = Field(..., description="Total candidate items in priority queue")
    high_priority_count: int = Field(..., description="Count of HIGH priority actions")
    medium_priority_count: int = Field(..., description="Count of MEDIUM priority actions")
    low_priority_count: int = Field(..., description="Count of LOW priority actions")
    agent_cases_count: int = Field(..., description="Count of agent cases in queue")
    merchant_cases_count: int = Field(..., description="Count of merchant cases in queue")
    top_operational_reason: str = Field(..., description="Most frequent operational flag reason")
    top_recommended_action: str = Field(..., description="Primary recommended action today")
    cross_network_alert: str | None = Field(
        default=None, description="Cross-network demand and liquidity correlation highlight"
    )
    briefing_text_en: str = Field(..., description="Deterministic morning brief in English")
    briefing_text_bn: str = Field(..., description="Deterministic morning brief in Bangla")


class DailyPrioritiesResponse(BaseModel):
    source: str = "synthetic"
    synthetic_data: bool = True
    serving_mode: str = "batch"
    scoring_formula: str = Field(..., description="Formula used for transparent deterministic scoring")
    briefing: MorningBriefing
    items: list[PriorityActionItem]
    cross_network_signals: list[dict[str, Any]] = Field(
        default_factory=list, description="Cross-network demand and liquidity overlap signals"
    )
    business_impact: dict[str, Any] | None = Field(
        default=None, description="Configurable synthetic business impact simulation data"
    )
    total: int
    limit: int
    offset: int


class ProductionDataRequirement(BaseModel):
    data_domain: str
    current_synthetic_status: str
    production_upay_requirement: str
    operational_purpose: str
