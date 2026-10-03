"""
AI Intelligence Copilot — assistant chat endpoint.

This is a deterministic grounded assistant that orchestrates the existing
intelligence services. It does NOT call any external LLM by default.
An optional LLM integration can be layered in later via the ASSISTANT_LLM_PROVIDER
environment variable (currently unused, reserved for future extension).

Security:
  - Requires existing cookie-based session via get_current_user
  - Respects CSRF validation (POST method → CSRF checked in get_current_user)
  - Enforces entity-level RBAC via enforce_entity_scope

Safety:
  - Never invents predictions, confidence, SHAP values, GPS, or real balances
  - Never claims ML metrics as real-world accuracy
  - Never describes abnormal activity as fraud
  - Returns structured evidence with every factual answer
"""

from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends

from app.repositories.artifacts import ArtifactRepository, get_artifact_repository
from app.security.dependencies import enforce_entity_scope, get_current_user
from app.services.intelligence import IntelligenceService
from app.schemas.assistant import AssistantRequest, AssistantResponse

router = APIRouter()


def _service(repository: ArtifactRepository = Depends(get_artifact_repository)) -> IntelligenceService:
    return IntelligenceService(repository)


# ---------------------------------------------------------------------------
# Intent detection helpers
# ---------------------------------------------------------------------------

_MERCHANT_ID_RE = re.compile(r"\bMRC\d+\b", re.IGNORECASE)
_AGENT_ID_RE = re.compile(r"\bAGT\d+\b", re.IGNORECASE)


def _extract_merchant_id(text: str) -> str | None:
    m = _MERCHANT_ID_RE.search(text)
    return m.group(0).upper() if m else None


def _extract_agent_id(text: str) -> str | None:
    m = _AGENT_ID_RE.search(text)
    return m.group(0).upper() if m else None


def _intent(text: str) -> str:
    lowered = text.lower()
    if _extract_merchant_id(text):
        return "explain_merchant"
    if _extract_agent_id(text):
        return "explain_agent"
    if any(w in lowered for w in ["demand", "forecast", "outlook"]):
        return "demand_outlook"
    if any(w in lowered for w in ["location", "expansion", "opportunit"]):
        return "location_opportunities"
    if any(w in lowered for w in ["churn", "inactiv"]):
        return "explain_churn"
    if any(w in lowered for w in ["liquidity", "cash", "agent liquid"]):
        return "explain_liquidity"
    if any(w in lowered for w in ["model", "engine", "ai", "predict", "algorithm", "decision rule"]):
        return "explain_models"
    if any(w in lowered for w in ["summarize", "summary", "latest", "intelligence", "overview"]):
        return "summary"
    return "unknown"


# ---------------------------------------------------------------------------
# Response builders — never invent data
# ---------------------------------------------------------------------------

def _na(value: Any) -> str:
    if value is None or value == "" or value is False:
        return "No data available"
    return str(value)


def _build_merchant_response(merchant_id: str, svc: IntelligenceService) -> dict:
    overview = svc.merchant_overview(merchant_id)
    if overview is None:
        return {
            "answer": f"No verified record was found for merchant **{merchant_id}**.",
            "evidence": [],
            "entities": [],
            "limitations": ["Merchant ID not found in the verified data set."],
            "suggested_action": None,
        }

    identity = overview.get("identity", {})
    demand = overview.get("demand_context", {})
    churn = overview.get("churn_context", {})
    benchmark = overview.get("benchmark_context", {})
    growth = overview.get("growth_context", {})

    category = _na(identity.get("merchant_category"))
    size = _na(identity.get("business_size"))
    status = _na(identity.get("merchant_status"))
    district = _na(identity.get("district"))

    # Demand
    demand_available = demand and demand.get("intelligence_available") is not False
    demand_level = _na(demand.get("demand_level")) if demand_available else "No demand intelligence available"
    demand_value = _na(demand.get("predicted_next_day_demand")) if demand_available else "—"
    demand_date = _na(demand.get("target_date")) if demand_available else "—"

    # Churn
    churn_available = churn and churn.get("intelligence_available") is not False
    risk_result = _na(churn.get("risk_result")) if churn_available else "No inactivity intelligence available"
    risk_level = _na(churn.get("risk_level")) if churn_available else "—"

    # Benchmark
    bench_available = benchmark and benchmark.get("intelligence_available") is not False
    perf_band = _na(benchmark.get("performance_band")) if bench_available else "No benchmark available"

    # Growth
    growth_available = growth and growth.get("intelligence_available") is not False
    growth_priority = _na(growth.get("growth_priority")) if growth_available else "No growth recommendation available"
    recommended_action = _na(growth.get("recommended_action")) if growth_available else "—"

    answer = (
        f"**{merchant_id}** is a **{category}** merchant ({size}, {status}) located in **{district}**.\n\n"
        f"**Tomorrow's Demand Outlook** (category-level, next day): The demand level for this merchant's category is **{demand_level}** "
        f"with a forecast value of **{demand_value}** for {demand_date}.\n\n"
        f"**Inactivity Signal**: The 30-day inactivity signal shows **{risk_result}** (risk level: {risk_level}).\n\n"
        f"**Peer Performance**: This merchant's performance band is **{perf_band}** relative to peers.\n\n"
        f"**Growth Priority**: **{growth_priority}**. Suggested next step: {recommended_action}."
    )

    limitations = []
    limitations.extend(demand.get("limitations", []) if demand_available else [])
    limitations.extend(churn.get("limitations", []) if churn_available else [])
    limitations.extend(benchmark.get("limitations", []) if bench_available else [])
    # Deduplicate
    seen = set()
    unique_limitations = []
    for lim in limitations:
        if lim not in seen:
            seen.add(lim)
            unique_limitations.append(lim)

    return {
        "answer": answer,
        "evidence": [
            {"source": "Merchant Profile", "data": {"category": category, "size": size, "status": status, "district": district}},
            {"source": "Merchant Demand Forecast (category-level)", "data": {"demand_level": demand_level, "value": demand_value, "date": demand_date}},
            {"source": "Merchant Inactivity Prediction", "data": {"result": risk_result, "risk_level": risk_level}},
            {"source": "Merchant Benchmarking Engine", "data": {"performance_band": perf_band}},
            {"source": "Growth Recommendation Engine", "data": {"priority": growth_priority, "action": recommended_action}},
        ],
        "entities": [{"type": "merchant", "id": merchant_id, "label": f"{merchant_id} ({category})"}],
        "limitations": unique_limitations or [
            "All data is synthetic. Values reflect batch intelligence outputs only.",
            "Consequential actions require human review.",
        ],
        "suggested_action": {
            "label": "Create Review Proposal",
            "target_type": "merchant",
            "target_id": merchant_id,
            "capability": "merchant_overview",
            "reason": f"AI Copilot review for {merchant_id}",
            "recommendation": recommended_action if growth_available else "Review merchant profile",
        } if growth_available and growth_priority not in ("No growth recommendation available",) else None,
    }


def _build_agent_response(agent_id: str, svc: IntelligenceService) -> dict:
    overview = svc.agent_overview(agent_id)
    if overview is None:
        return {
            "answer": f"No verified record was found for agent **{agent_id}**.",
            "evidence": [],
            "entities": [],
            "limitations": ["Agent ID not found in the verified data set."],
            "suggested_action": None,
        }

    identity = overview.get("identity", {})
    liquidity = overview.get("liquidity_context", {})
    performance = overview.get("performance_context", {})
    operational = overview.get("operational_review_context", {})

    district = _na(identity.get("district"))
    agent_type = _na(identity.get("agent_type"))
    status = _na(identity.get("status"))
    capacity = _na(identity.get("liquidity_limit_capacity_proxy"))

    # Liquidity
    liq_available = liquidity and liquidity.get("intelligence_available") is not False
    risk_level = _na(liquidity.get("risk_level")) if liq_available else "No liquidity intelligence available"
    recommended_cash = _na(liquidity.get("recommended_cash")) if liq_available else "—"
    liq_date = _na(liquidity.get("target_date")) if liq_available else "—"

    # Performance
    perf_available = performance and performance.get("intelligence_available") is not False
    perf_band = _na(performance.get("performance_band")) if perf_available else "No performance intelligence available"
    perf_action = _na(performance.get("recommended_action")) if perf_available else "—"

    # Operational flags
    flags = operational.get("flags", []) if operational else []
    review_signal = bool(flags)
    statement = operational.get("statement", "Abnormal operational activity is a review signal and does not imply fraud.") if operational else ""

    answer = (
        f"**{agent_id}** is a **{agent_type}** agent with status **{status}** in **{district}**.\n\n"
        f"**Tomorrow's Liquidity Outlook** (next-day batch): The operational stress band is **{risk_level}** "
        f"for {liq_date}. Recommended cash preparation: **{recommended_cash}**.\n\n"
        f"**Estimated Capacity**: {capacity} (capacity proxy — not live wallet or cash balance).\n\n"
        f"**Performance**: Performance band is **{perf_band}**. Suggested action: {perf_action}.\n\n"
        f"**Operational Review**: {'⚠ Review signals present: ' + ', '.join(flags) + '. ' + statement if review_signal else 'No operational review flags.'}"
    )

    limitations = []
    limitations.extend(liquidity.get("limitations", []) if liq_available else [])
    limitations.extend(performance.get("limitations", []) if perf_available else [])
    seen = set()
    unique_limitations = []
    for lim in limitations:
        if lim not in seen:
            seen.add(lim)
            unique_limitations.append(lim)

    return {
        "answer": answer,
        "evidence": [
            {"source": "Agent Profile", "data": {"type": agent_type, "status": status, "district": district}},
            {"source": "Agent Liquidity Intelligence (LightGBM, next-day)", "data": {"stress_band": risk_level, "recommended_cash": recommended_cash, "date": liq_date}},
            {"source": "Agent Performance Intelligence", "data": {"performance_band": perf_band}},
            {"source": "Operational Review Signals", "data": {"review_signal": review_signal, "flags": flags, "note": statement}},
        ],
        "entities": [{"type": "agent", "id": agent_id, "label": f"{agent_id} ({agent_type})"}],
        "limitations": unique_limitations or [
            "All data is synthetic. Values reflect batch intelligence outputs only.",
            "Liquidity limit is a capacity proxy, not confirmed live cash.",
            "Risk bands are operational stress bands, not shortage probabilities.",
            "Consequential financial actions require human/operator review.",
        ],
        "suggested_action": {
            "label": "Create Review Proposal",
            "target_type": "agent",
            "target_id": agent_id,
            "capability": "agent_liquidity",
            "reason": f"AI Copilot review for {agent_id}",
            "recommendation": perf_action if perf_available else "Review agent profile",
        } if review_signal or (liq_available and risk_level.lower() in ("high", "critical")) else None,
    }


def _build_demand_response(svc: IntelligenceService) -> dict:
    result = svc.demand_forecasts(limit=20, offset=0)
    items = result.get("items", [])
    if not items:
        return {
            "answer": "No demand forecast data is currently available from the verified batch.",
            "evidence": [],
            "entities": [],
            "limitations": result.get("limitations", []),
            "suggested_action": None,
        }

    summary_lines = []
    for item in items[:8]:
        cat = _na(item.get("merchant_category"))
        level = _na(item.get("demand_level"))
        val = _na(item.get("predicted_next_day_demand"))
        date = _na(item.get("target_date"))
        summary_lines.append(f"- **{cat}**: {level} (forecast value {val}, date {date})")

    answer = (
        "**Tomorrow's Demand Outlook** — Category-level, next-day batch forecast (XGBoost).\n\n"
        + "\n".join(summary_lines)
        + "\n\n*This is a category-level point forecast. No merchant-specific or hourly forecast is implied. No P50/P90 intervals exist.*"
    )

    return {
        "answer": answer,
        "evidence": [{"source": "Merchant Demand Forecasting (XGBoost)", "data": {"rows": len(items), "scope": "merchant_category", "horizon": "next_day"}}],
        "entities": [],
        "limitations": result.get("limitations", ["Category-level next-day point forecast only."]),
        "suggested_action": None,
    }


def _build_location_response(svc: IntelligenceService) -> dict:
    result = svc.location_opportunities(limit=10, offset=0)
    items = result.get("items", [])
    if not items:
        return {
            "answer": "No location opportunity data is currently available.",
            "evidence": [],
            "entities": [],
            "limitations": result.get("limitations", []),
            "suggested_action": None,
        }

    high_priority = [i for i in items if str(i.get("expansion_priority", "")).lower() in ("high", "critical")]
    summary_lines = []
    for item in (high_priority or items)[:6]:
        loc_id = _na(item.get("location_id"))
        district = _na(item.get("district"))
        priority = _na(item.get("expansion_priority"))
        score = _na(item.get("location_opportunity_score"))
        rec = _na(item.get("recommended_expansion"))
        summary_lines.append(f"- **{loc_id}** ({district}): Priority **{priority}**, score {score}, recommended: {rec}")

    answer = (
        "**Expansion Opportunities** — Location Intelligence (percentile decision-support engine).\n\n"
        + "\n".join(summary_lines)
        + "\n\n*These are schematic location scores, not real GPS locations. 'CRITICAL' means relative opportunity priority, not an emergency.*"
    )

    return {
        "answer": answer,
        "evidence": [{"source": "Location Intelligence Engine (percentile)", "data": {"locations_analyzed": result.get("total", 0), "high_priority": len(high_priority)}}],
        "entities": [{"type": "location", "id": str(i.get("location_id")), "label": f"{i.get('location_id')} ({i.get('district')})"} for i in (high_priority or items)[:4]],
        "limitations": result.get("limitations", ["Relative percentile decision support, not trained ML or a probability.", "No real GPS coordinates."]),
        "suggested_action": None,
    }


def _build_churn_explanation() -> dict:
    return {
        "answer": (
            "**Merchant Inactivity Prediction** — What it means:\n\n"
            "The system flags merchants who appear to be at risk of 30-day inactivity based on their transaction history. "
            "A 'flagged' result means the merchant's recent activity pattern suggests they may not transact in the next 30 days.\n\n"
            "**Important limitations:**\n"
            "- The inactivity label is derived from whether `days_since_last_txn >= 30`, making it deterministic from observed data, not a true forward-looking prediction.\n"
            "- Documented evaluation metrics of 1.0 do not establish generalizable real-world performance.\n"
            "- Some merchants may not have an inactivity signal if their profile does not uniquely match the feature set.\n\n"
            "Use this signal to flag merchants for human review, not as an automatic trigger for action."
        ),
        "evidence": [{"source": "Merchant Inactivity Prediction (classifier pipeline)", "data": {"horizon": "30-day inactivity", "label_type": "deterministic from days_since_last_txn >= 30"}}],
        "entities": [],
        "limitations": [
            "Operational interpretation is 30-day inactivity risk.",
            "The supplied label is deterministic: actual_churn is positive when days_since_last_txn is at least 30.",
            "Documented 1.0 metrics do not establish generalizable real-world performance.",
        ],
        "suggested_action": None,
    }


def _build_liquidity_explanation() -> dict:
    return {
        "answer": (
            "**Agent Liquidity Intelligence** — What it means:\n\n"
            "The system provides a next-day cash preparation recommendation for each agent based on predicted cashout demand. "
            "This helps operators plan agent readiness before the next business day.\n\n"
            "**Key terms:**\n"
            "- **Recommended Cash**: The suggested amount to have available tomorrow — not a guarantee.\n"
            "- **Estimated Capacity (liquidity_limit)**: A capacity proxy derived from the agent's historical data, *not* live wallet or cash balance.\n"
            "- **Stress Band** (LOW/MEDIUM/HIGH): An operational band, not a shortage probability.\n"
            "- **Recommended Cash Coverage (89.93%)**: This is a backtested coverage metric, not model accuracy.\n\n"
            "**Engine**: LightGBM Regressor, version 2.0-cleaned-next-day. The model has a weak test R² (-0.0095), which is a known limitation. "
            "Consequential financial actions require human/operator review."
        ),
        "evidence": [{"source": "Agent Liquidity Intelligence (LightGBM, next-day)", "data": {"horizon": "next_day", "coverage_metric": "89.93% (not accuracy)", "r2": "-0.0095 (known weak test R²)"}}],
        "entities": [],
        "limitations": [
            "Validated batch output for next calendar day only.",
            "liquidity_limit is a capacity proxy, not confirmed live cash availability.",
            "Risk bands are operational stress bands, not shortage probabilities.",
            "Recommended-cash coverage is not model accuracy.",
            "Consequential financial actions require human/operator review.",
        ],
        "suggested_action": None,
    }


def _build_models_explanation() -> dict:
    return {
        "answer": (
            "**AI Models & Decision Rules in this system:**\n\n"
            "**Predictive AI Models:**\n"
            "1. **Merchant Demand Forecasting** (XGBoost Regressor) — Category-level next-day point forecast. MAE: ~9,835. R²: 0.77.\n"
            "2. **Merchant Inactivity Prediction** (classifier pipeline) — 30-day inactivity risk. Note: label is deterministic from transaction data.\n"
            "3. **Agent Liquidity Intelligence** (LightGBM Regressor) — Next-day cash preparation. Test R²: -0.0095 (weak, known limitation).\n\n"
            "**Decision Engines (rule/percentile-based, not trained ML):**\n"
            "4. **Merchant Benchmarking** — Peer-relative percentile engine. Not a probability.\n"
            "5. **Merchant Growth Recommendation** — Rule + peer benchmark engine. Score is not a probability.\n"
            "6. **Agent Performance Intelligence** — Rule/percentile engine. Abnormal activity is a review signal, not fraud detection.\n"
            "7. **Location Intelligence** — Percentile decision-support engine. No real GPS coordinates.\n\n"
            "All data is synthetic. All outputs require human review before any consequential action."
        ),
        "evidence": [
            {"source": "Model Registry", "data": {"predictive_models": 3, "decision_engines": 4}},
        ],
        "entities": [],
        "limitations": [
            "All models use synthetic data.",
            "Decision engines are not trained ML models.",
            "No SHAP values are supplied.",
            "Consequential actions require human review.",
        ],
        "suggested_action": None,
    }


def _build_summary_response(svc: IntelligenceService) -> dict:
    merchants_result = svc.merchants(limit=1, offset=0)
    agents_result = svc.agents(limit=1, offset=0)
    demand_result = svc.demand_forecasts(limit=5, offset=0)
    locations_result = svc.location_opportunities(limit=5, offset=0)

    merchant_total = merchants_result.get("total", 0)
    agent_total = agents_result.get("total", 0)
    demand_total = demand_result.get("total", 0)
    location_total = locations_result.get("total", 0)

    top_demand = demand_result.get("items", [])
    top_loc = [i for i in locations_result.get("items", []) if str(i.get("expansion_priority", "")).lower() in ("high", "critical")]

    demand_summary = ", ".join(
        f"{_na(i.get('merchant_category'))} ({_na(i.get('demand_level'))})"
        for i in top_demand[:3]
    ) or "No demand data available"

    answer = (
        f"**MFS Intelligence Summary — Synthetic Demo**\n\n"
        f"- **{merchant_total}** verified merchants · **{agent_total}** verified agents\n"
        f"- **{demand_total}** category-day demand forecast rows (next-day, XGBoost)\n"
        f"- **{location_total}** location opportunity indices analyzed\n"
        f"- **{len(top_loc)}** locations flagged as high/critical expansion priority\n\n"
        f"**Sample demand signals**: {demand_summary}\n\n"
        "*All values are from synthetic batch data. Use the Merchant, Agent, Location, and Action Review pages for details.*"
    )

    return {
        "answer": answer,
        "evidence": [
            {"source": "Merchant Master", "data": {"total": merchant_total}},
            {"source": "Agent Master", "data": {"total": agent_total}},
            {"source": "Demand Forecasting (XGBoost)", "data": {"total_rows": demand_total}},
            {"source": "Location Intelligence", "data": {"total_locations": location_total, "high_priority": len(top_loc)}},
        ],
        "entities": [],
        "limitations": [
            "All data is synthetic.",
            "Values reflect batch intelligence outputs, not real-time operations.",
        ],
        "suggested_action": None,
    }


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/chat", response_model=AssistantResponse)
def assistant_chat(
    payload: AssistantRequest,
    user=Depends(get_current_user),
    svc: IntelligenceService = Depends(_service),
) -> AssistantResponse:
    """
    Grounded AI assistant chat endpoint.
    Requires existing authentication (cookie + CSRF). Respects entity-level RBAC.
    Never invents predictions. Returns structured evidence with every answer.
    """
    message = (payload.message or "").strip()
    if not message:
        return AssistantResponse(
            answer="Please ask a question about merchants, agents, demand, or the AI models.",
            evidence=[],
            entities=[],
            limitations=[],
            suggested_action=None,
            assistant_mode="grounded_intelligence",
        )

    detected = _intent(message)

    if detected == "explain_merchant":
        merchant_id = _extract_merchant_id(message)
        # RBAC: enforce entity scope
        if merchant_id:
            from app.security.dependencies import enforce_entity_scope
            enforce_entity_scope(user, "merchant", merchant_id)
            result = _build_merchant_response(merchant_id, svc)
        else:
            result = {"answer": "I could not identify a merchant ID in your question. Try 'Explain MRC000001'.", "evidence": [], "entities": [], "limitations": [], "suggested_action": None}

    elif detected == "explain_agent":
        agent_id = _extract_agent_id(message)
        if agent_id:
            from app.security.dependencies import enforce_entity_scope
            enforce_entity_scope(user, "agent", agent_id)
            result = _build_agent_response(agent_id, svc)
        else:
            result = {"answer": "I could not identify an agent ID in your question. Try 'Explain AGT00001'.", "evidence": [], "entities": [], "limitations": [], "suggested_action": None}

    elif detected == "demand_outlook":
        if user.role not in {"ADMIN", "ANALYST", "REGIONAL_MANAGER", "MERCHANT", "JUDGE"}:
            from app.core.errors import APIError
            raise APIError(403, "forbidden", "You are not authorized to view demand forecasts.")
        result = _build_demand_response(svc)

    elif detected == "location_opportunities":
        if user.role not in {"ADMIN", "ANALYST", "REGIONAL_MANAGER", "JUDGE"}:
            from app.core.errors import APIError
            raise APIError(403, "forbidden", "You are not authorized to view location opportunities.")
        result = _build_location_response(svc)

    elif detected == "explain_churn":
        result = _build_churn_explanation()

    elif detected == "explain_liquidity":
        result = _build_liquidity_explanation()

    elif detected == "explain_models":
        result = _build_models_explanation()

    elif detected == "summary":
        if user.role in {"ADMIN", "ANALYST", "REGIONAL_MANAGER", "JUDGE"}:
            result = _build_summary_response(svc)
        elif user.role == "MERCHANT" and user.linked_entity_id:
            result = _build_merchant_response(user.linked_entity_id, svc)
        elif user.role == "AGENT" and user.linked_entity_id:
            result = _build_agent_response(user.linked_entity_id, svc)
        else:
            from app.core.errors import APIError
            raise APIError(403, "forbidden", "You are not authorized to view the overall intelligence summary.")

    else:
        result = {
            "answer": (
                "I can help with questions about merchants, agents, demand forecasts, expansion locations, and the AI models.\n\n"
                "Try asking:\n"
                "- *Explain MRC000001*\n"
                "- *Explain AGT00001*\n"
                "- *Show the demand outlook*\n"
                "- *Show expansion opportunities*\n"
                "- *What AI models are used?*\n"
                "- *Summarize the latest intelligence*"
            ),
            "evidence": [],
            "entities": [],
            "limitations": [],
            "suggested_action": None,
        }

    return AssistantResponse(
        answer=result["answer"],
        evidence=result.get("evidence", []),
        entities=result.get("entities", []),
        limitations=result.get("limitations", []),
        suggested_action=result.get("suggested_action"),
        assistant_mode="grounded_intelligence",
    )
