"""Pydantic schemas for the AI Copilot assistant endpoint."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AssistantRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="The user's question.")
    locale: str = Field(default="en", description="Locale preference: 'en' or 'bn'.")
    entity_context: dict[str, Any] | None = Field(
        default=None,
        description="Optional entity context (e.g., current merchant or agent page).",
    )


class EvidenceItem(BaseModel):
    source: str
    data: dict[str, Any] = Field(default_factory=dict)


class EntityLink(BaseModel):
    type: str  # "merchant" | "agent" | "location"
    id: str
    label: str


class SuggestedAction(BaseModel):
    label: str
    target_type: str
    target_id: str
    capability: str
    reason: str
    recommendation: str


class AssistantResponse(BaseModel):
    answer: str
    evidence: list[EvidenceItem] = Field(default_factory=list)
    entities: list[EntityLink] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    suggested_action: SuggestedAction | None = None
    assistant_mode: str = "grounded_intelligence"
