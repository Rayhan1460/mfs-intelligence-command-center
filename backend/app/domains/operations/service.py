from collections import Counter
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Intervention
from app.repositories.artifacts import ArtifactRepository
from app.schemas.operations import (
    DailyPrioritiesResponse,
    MorningBriefing,
    PriorityActionItem,
    ProductionDataRequirement,
)
from app.services.intelligence import (
    _boolean,
    _churn_by_merchant,
    _integer,
    _number,
)

SCORING_FORMULA_DOC = (
    "priority_score = round((0.45 * severity_weight + 0.35 * urgency_weight + "
    "0.20 * confidence_weight) * 100, 1) | "
    "Severity: calibrated stress/inactivity intensity | "
    "Urgency: expected operational risk to cash-out or retention | "
    "Confidence: validated model and feature coverage quality | "
    "Bands: HIGH >= 75.0, MEDIUM 50.0-74.9, LOW < 50.0"
)

PRODUCTION_DATA_REQUIREMENTS: list[dict[str, str]] = [
    {
        "data_domain": "Agent Live Float Balance",
        "current_synthetic_status": "Batch capacity proxy (liquidity_limit) only; static snapshot",
        "production_upay_requirement": "Real-time core banking / MFS ledger balance stream per agent wallet",
        "operational_purpose": "Prevent intraday cash-out service depletion and automate float rebalancing trigger",
    },
    {
        "data_domain": "Cash-in / Cash-out Transaction Stream",
        "current_synthetic_status": "Aggregated 7d/30d/90d historical batch aggregates",
        "production_upay_requirement": "Sub-minute transaction events with transaction type, status, and fee breakdown",
        "operational_purpose": "Detect instant liquidity spikes, run-rates, and localized cash drain",
    },
    {
        "data_domain": "Failed Transaction Events",
        "current_synthetic_status": "Not supplied in synthetic dataset (inferred via service_gap_flag)",
        "production_upay_requirement": "Real-time error logs (e.g. Insufficient Float, Timeout, Network Error)",
        "operational_purpose": "Immediate dispatch of float replenishment before customer churns to competitors",
    },
    {
        "data_domain": "Merchant QR & Channel Adoption",
        "current_synthetic_status": "Binary flags (qr_enabled, app_enabled) without scan activity logs",
        "production_upay_requirement": "Live Bangla QR dynamic scan logs, merchant app logins, and payment gateway events",
        "operational_purpose": "Target inactive QR merchants for field activation and POS collateral replacement",
    },
    {
        "data_domain": "Field-Visit & CRM Logs",
        "current_synthetic_status": "Future data required; no past officer visit history in synthetic dataset",
        "production_upay_requirement": "Territory Officer (TO) / Territory Manager (TM) GPS check-ins and outcome reports",
        "operational_purpose": "Track closed-loop resolution of operational interventions and officer SLA",
    },
    {
        "data_domain": "Real GPS & Outlet Geography",
        "current_synthetic_status": "Schematic district / area_type categorical mapping; no coordinates",
        "production_upay_requirement": "Verified outlet coordinates (lat/long) where regulatory policy permits",
        "operational_purpose": "Spatial routing for cash distribution vans and route-to-market optimization",
    },
    {
        "data_domain": "Holiday & Eid Event Calendar",
        "current_synthetic_status": "Calendar dates without national festival or salary disbursement overlays",
        "production_upay_requirement": "National MFS calendar: Eid-ul-Fitr, Eid-ul-Adha, Pohela Boishakh, monthly salary cycle",
        "operational_purpose": "Pre-position liquidity buffers 72 hours before massive nationwide remittance surges",
    },
]


class OperationsService:
    def __init__(self, repository: ArtifactRepository) -> None:
        self.repository = repository

    def _get_active_interventions_map(
        self, session: Session | None
    ) -> dict[tuple[str, str], Intervention]:
        if session is None:
            return {}
        try:
            # Query recent open interventions
            stmt = (
                select(Intervention)
                .order_by(Intervention.updated_at.desc(), Intervention.id.desc())
            )
            records = session.scalars(stmt).all()
            result: dict[tuple[str, str], Intervention] = {}
            for rec in records:
                key = (rec.target_type.casefold(), rec.target_id)
                if key not in result:
                    result[key] = rec
            return result
        except Exception:
            return {}

    def get_candidate_priorities(
        self, session: Session | None = None
    ) -> list[PriorityActionItem]:
        churn_map = _churn_by_merchant(self.repository)
        try:
            forward_churn_map = {r["merchant_id"]: r for r in self.repository.rows("forward_churn")}
        except Exception:
            forward_churn_map = {}
        try:
            underperf_map = {r["agent_id"]: r for r in self.repository.rows("agent_underperformance")}
        except Exception:
            underperf_map = {}

        liq_rows = self.repository.rows("liquidity")
        latest_target_date = max((r.get("target_date", "") for r in liq_rows), default="")
        liq_by_agent = {
            r["agent_id"]: r
            for r in liq_rows
            if r.get("target_date") == latest_target_date
        }
        perf_by_agent = {r["agent_id"]: r for r in self.repository.rows("agent_performance")}
        growth_by_merchant = {r["merchant_id"]: r for r in self.repository.rows("growth")}
        loc_by_id = {r["location_id"]: r for r in self.repository.rows("locations")}
        interventions_map = self._get_active_interventions_map(session)

        candidates: list[dict[str, Any]] = []

        # 1. Evaluate Agents
        for agent in self.repository.rows("agents"):
            aid = agent["agent_id"]
            location_id = agent.get("location_id")
            loc = loc_by_id.get(location_id or "")
            district = loc.get("district", "Unknown") if loc else "Unknown"
            liq = liq_by_agent.get(aid)
            perf = perf_by_agent.get(aid)
            underperf = underperf_map.get(aid)

            liq_risk = (liq.get("risk_level") or "").upper() if liq else ""
            stress_pct = _number(liq.get("liquidity_stress_percent")) if liq else None
            pred_cashout = _number(liq.get("predicted_next_day_cashout")) if liq else None

            has_service_gap = perf and _boolean(perf.get("service_gap_flag"))
            is_declining = perf and _boolean(perf.get("declining_agent"))
            has_abnormal = perf and _boolean(perf.get("abnormal_pattern_flag"))

            is_underperf_pred = underperf and underperf.get("predicted_underperformance") == "1"
            underperf_prob = _number(underperf.get("underperformance_risk_probability")) if underperf else None

            if (
                liq_risk in {"CRITICAL", "HIGH"}
                or (has_service_gap and is_declining)
                or is_underperf_pred
                or has_abnormal
                or liq_risk == "MEDIUM"
            ):
                if liq_risk == "CRITICAL":
                    s, u, c = 1.0, 0.95, 1.0
                    reason = "Severe liquidity stress before peak cash-out period"
                    action = (
                        "Contact agent and arrange emergency float / cash support before peak window"
                    )
                    exp_val = "Prevent failed cash-out transactions and agent cash stockout"
                elif liq_risk == "HIGH":
                    s, u, c = 0.88, 0.90, 1.0
                    reason = "Expected liquidity pressure before peak cash-out period"
                    action = "Arrange additional float / cash support before peak period"
                    exp_val = "Reduce probability of failed cash-out service"
                elif has_service_gap and is_declining:
                    s, u, c = 0.78, 0.85, 0.95
                    reason = "Service gap detected with declining transaction momentum"
                    action = (
                        "Field officer visit to inspect shop readiness and liquidity constraints"
                    )
                    exp_val = "Restore cash-in and cash-out availability in coverage area"
                elif is_underperf_pred:
                    s, u, c = 0.76, 0.82, 0.95
                    reason = "Predicted service gap / agent underperformance state"
                    action = "Schedule territory supervisor visit to inspect outlet activity and agent readiness"
                    exp_val = "Prevent localized service outage and preserve agent network capacity"
                elif has_abnormal:
                    s, u, c = 0.72, 0.80, 0.90
                    reason = "Abnormal operational activity flagged for managerial review"
                    action = "Review agent transaction pattern with District Manager"
                    exp_val = "Maintain network integrity and compliance assurance"
                else:  # MEDIUM
                    s, u, c = 0.55, 0.60, 0.90
                    reason = "Moderate liquidity stress ahead of next-day demand"
                    action = "Monitor agent float balance and prepare distributor buffer"
                    exp_val = "Maintain smooth service continuity during transaction surge"

                score = round((0.45 * s + 0.35 * u + 0.20 * c) * 100, 1)
                evidence = (
                    f"Predicted cash-out: {pred_cashout:,.0f} BDT; Liquidity stress: {stress_pct:.1f}% (Risk band: {liq_risk})"
                    if stress_pct is not None and pred_cashout is not None
                    else (((perf.get("recommendation_reason") if perf else None)) or "Validated agent operational signal")
                )

                source_modules = ["liquidity"]
                if perf and (has_service_gap or is_declining or has_abnormal):
                    source_modules.append("agent_performance")

                future_data = [
                    "Real-time live wallet float balance",
                    "Hourly cash-in/cash-out stream",
                    "Field officer visit check-in history",
                ]

                interv = interventions_map.get(("agent", aid))
                review_status = interv.status if interv else "PENDING_REVIEW"
                intervention_id = interv.id if interv else None

                candidates.append(
                    {
                        "priority_score": score,
                        "priority_level": "HIGH" if score >= 75.0 else ("MEDIUM" if score >= 50.0 else "LOW"),
                        "entity_id": aid,
                        "entity_type": "agent",
                        "entity_name_or_category": f"Agent ({agent.get('agent_type', 'Retail')})",
                        "district": district,
                        "location_id": location_id,
                        "reason": reason,
                        "evidence": evidence,
                        "recommended_action": action,
                        "expected_value_label": exp_val,
                        "confidence_label": "P90 operational buffer — calibrated coverage; point forecast weak",
                        "source_modules": source_modules,
                        "review_status": review_status,
                        "intervention_id": intervention_id,
                        "future_data_required": future_data,
                    }
                )

        # 2. Evaluate Merchants
        for merchant in self.repository.rows("merchants"):
            mid = merchant["merchant_id"]
            location_id = merchant.get("location_id")
            loc = loc_by_id.get(location_id or "")
            district = loc.get("district", "Unknown") if loc else "Unknown"
            cat = merchant.get("merchant_category", "General")
            churn = churn_map.get(mid)
            growth = growth_by_merchant.get(mid)
            fwd = forward_churn_map.get(mid)
            if fwd:
                fwd_prob = _number(fwd.get("forward_churn_probability"))
                fwd_pred = fwd.get("forward_churn_prediction") == "1"
                is_churn_flagged = fwd_pred or (fwd_prob is not None and fwd_prob >= 0.35)
                is_fwd_source = True
            else:
                churn_risk = (churn.get("risk_level") or "").casefold() if churn else ""
                is_churn_flagged = bool(churn and (churn_risk == "critical" or churn.get("predicted_churn") == "1"))
                is_fwd_source = False

            growth_prio = (growth.get("growth_priority") or "").upper() if growth else ""
            days_idle = _integer(growth.get("days_since_last_txn")) if growth else None

            if is_churn_flagged or growth_prio in {"CRITICAL", "HIGH"}:
                if is_churn_flagged:
                    s, u, c = 0.95, 0.90, 1.0
                    if is_fwd_source and fwd is not None:
                        prob = _number(fwd.get("forward_churn_probability"))
                        prob_str = f"{prob:.1%}" if prob is not None else "High"
                        reason = "Forward-looking 30-day merchant inactivity hazard"
                        evidence = f"Forward hazard LightGBM model flagged 30d risk (probability: {prob_str}, cutoff: 2026-08-31)"
                    else:
                        reason = "LEGACY / HISTORICAL INACTIVITY RULE flagged merchant"
                        evidence = f"Historical inactivity rule (days_since_last_txn >= 30, idle {days_idle}d)"
                    action = "Field officer follow-up visit and merchant retention campaign review"
                    exp_val = "Prevent merchant attrition and retain wallet transaction volume"
                    source_modules = ["churn"]
                elif growth_prio == "CRITICAL" and growth is not None:
                    s, u, c = 0.82, 0.80, 0.95
                    reason = "Severe transaction slowdown below peer cohort median"
                    action = (
                        growth.get("recommended_action")
                        or "Deploy merchant engagement specialist to evaluate QR usage"
                    )
                    exp_val = "Reactivate merchant activity and restore peer benchmark parity"
                    evidence = (
                        growth.get("recommendation_reason")
                        or f"Growth priority CRITICAL, idle {days_idle}d"
                    )
                    source_modules = ["growth", "benchmark"]
                elif growth is not None:
                    s, u, c = 0.68, 0.70, 0.90
                    reason = "High growth opportunity with significant peer benchmark gap"
                    action = (
                        growth.get("recommended_action")
                        or "Offer incentive campaign on digital payments and QR adoption"
                    )
                    exp_val = "Unlock untapped merchant payment volume and customer reach"
                    evidence = (
                        growth.get("recommendation_reason")
                        or f"Growth priority HIGH (score: {growth.get('growth_opportunity_score')})"
                    )
                    source_modules = ["growth"]
                else:
                    s, u, c = 0.50, 0.50, 0.50
                    reason = "Merchant flagged for operations review"
                    action = "Review merchant status and activity trend"
                    exp_val = "Evaluate merchant engagement"
                    evidence = f"Merchant {mid} requires review"
                    source_modules = ["merchant"]

                score = round((0.45 * s + 0.35 * u + 0.20 * c) * 100, 1)

                future_data = [
                    "Real-time Bangla QR scan log",
                    "Merchant digital checkout channel volume",
                    "Field team retention visit log",
                ]

                interv = interventions_map.get(("merchant", mid))
                review_status = interv.status if interv else "PENDING_REVIEW"
                intervention_id = interv.id if interv else None

                candidates.append(
                    {
                        "priority_score": score,
                        "priority_level": "HIGH" if score >= 75.0 else ("MEDIUM" if score >= 50.0 else "LOW"),
                        "entity_id": mid,
                        "entity_type": "merchant",
                        "entity_name_or_category": f"{cat} ({merchant.get('business_size', 'Small')})",
                        "district": district,
                        "location_id": location_id,
                        "reason": reason,
                        "evidence": evidence,
                        "recommended_action": action,
                        "expected_value_label": exp_val,
                        "confidence_label": "High quality (Reconstructed exact feature match)",
                        "source_modules": source_modules,
                        "review_status": review_status,
                        "intervention_id": intervention_id,
                        "future_data_required": future_data,
                    }
                )

        # Deterministic ranking: highest priority_score first, then entity_type ("agent" before "merchant"), then entity_id
        candidates.sort(
            key=lambda item: (-item["priority_score"], item["entity_type"], item["entity_id"])
        )

        output: list[PriorityActionItem] = []
        for idx, item in enumerate(candidates, start=1):
            output.append(
                PriorityActionItem(
                    priority_rank=idx,
                    **item,
                )
            )
        return output

    def compute_morning_briefing(
        self, items: list[PriorityActionItem]
    ) -> MorningBriefing:
        liq_rows = self.repository.rows("liquidity")
        latest_date = max((r.get("target_date", "") for r in liq_rows), default="2026-09-30")

        total = len(items)
        high_count = sum(1 for item in items if item.priority_level == "HIGH")
        med_count = sum(1 for item in items if item.priority_level == "MEDIUM")
        low_count = sum(1 for item in items if item.priority_level == "LOW")
        agent_count = sum(1 for item in items if item.entity_type == "agent")
        merchant_count = sum(1 for item in items if item.entity_type == "merchant")

        reason_counts = Counter(item.reason for item in items)
        top_reason = (
            reason_counts.most_common(1)[0][0]
            if reason_counts
            else "Operational queue cleared"
        )

        action_counts = Counter(item.recommended_action for item in items)
        top_action = (
            action_counts.most_common(1)[0][0]
            if action_counts
            else "Continue standard network monitoring"
        )

        # Count specific subsets for detailed deterministic briefing statement
        high_liquidity_agents = sum(
            1
            for item in items
            if item.entity_type == "agent" and "liquidity" in item.reason.casefold()
        )
        churn_merchants = sum(
            1
            for item in items
            if item.entity_type == "merchant" and "churn" in item.reason.casefold()
        )
        growth_merchants = sum(
            1
            for item in items
            if item.entity_type == "merchant" and "growth" in item.reason.casefold()
        )

        en_text = (
            f"Today, {high_liquidity_agents} agents show elevated liquidity stress, "
            f"{churn_merchants} merchants require churn-related follow-up, and "
            f"{growth_merchants} merchant growth opportunities are flagged for review. "
            f"{high_count} total cases demand immediate managerial attention."
        )

        bn_text = (
            f"আজকে {high_liquidity_agents}টি এজেন্টের লিকুইডিটি চাপ চিহ্নিত হয়েছে, "
            f"{churn_merchants}টি মার্চেন্টের জন্য নিষ্ক্রিয়তা প্রতিরোধে ফলো-আপ প্রয়োজন, এবং "
            f"{growth_merchants}টি মার্চেন্ট প্রবৃদ্ধির সুযোগ পর্যালোচনার জন্য প্রস্তুত। "
            f"মোট {high_count}টি জরুরি বিষয়ে তাৎক্ষণিক সিদ্ধান্ত নেওয়া প্রয়োজন।"
        )

        return MorningBriefing(
            as_of_date=latest_date,
            total_actions_flagged=total,
            high_priority_count=high_count,
            medium_priority_count=med_count,
            low_priority_count=low_count,
            agent_cases_count=agent_count,
            merchant_cases_count=merchant_count,
            top_operational_reason=top_reason,
            top_recommended_action=top_action,
            briefing_text_en=en_text,
            briefing_text_bn=bn_text,
        )

    def daily_priorities(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        entity_type: str | None = None,
        priority: str | None = None,
        district: str | None = None,
        session: Session | None = None,
    ) -> DailyPrioritiesResponse:
        all_candidates = self.get_candidate_priorities(session)
        briefing = self.compute_morning_briefing(all_candidates)

        filtered = all_candidates
        if entity_type:
            target_type = entity_type.casefold()
            filtered = [item for item in filtered if item.entity_type == target_type]
        if priority:
            prio = priority.upper()
            filtered = [item for item in filtered if item.priority_level == prio]
        if district:
            dist = district.casefold()
            filtered = [item for item in filtered if dist in item.district.casefold()]

        paginated = filtered[offset : offset + limit]

        return DailyPrioritiesResponse(
            source="synthetic",
            synthetic_data=True,
            serving_mode="batch",
            scoring_formula=SCORING_FORMULA_DOC,
            briefing=briefing,
            items=paginated,
            total=len(filtered),
            limit=limit,
            offset=offset,
        )

    @staticmethod
    def get_production_data_requirements() -> list[ProductionDataRequirement]:
        return [ProductionDataRequirement(**req) for req in PRODUCTION_DATA_REQUIREMENTS]
