from collections import Counter
from datetime import date
from functools import lru_cache
from typing import Any

from app.repositories.artifacts import ArtifactRepository

CHURN_FEATURES = (
    "merchant_category",
    "business_size",
    "location_id",
    "merchant_tenure_days",
    "qr_enabled",
    "app_enabled",
    "days_since_last_txn",
    "txn_count_7d",
    "txn_value_7d",
    "unique_customers_7d",
    "active_days_7d",
    "txn_count_30d",
    "txn_value_30d",
    "unique_customers_30d",
    "active_days_30d",
    "txn_count_90d",
    "txn_value_90d",
    "unique_customers_90d",
    "active_days_90d",
    "avg_txn_value_30d",
)

CHURN_LIMITATIONS = [
    "Operational interpretation is 30-day inactivity risk.",
    "The supplied label is deterministic: actual_churn is positive when days_since_last_txn is at least 30.",
    "Documented 1.0 metrics do not establish generalizable real-world performance.",
    "Merchant IDs are reconstructed only from unique exact matches on the documented non-label feature fields; unmatched records are not assigned.",
]

DEMAND_LIMITATIONS = [
    "Category-level next-day point forecast; it is not a merchant-specific or hourly forecast.",
    "No P50/P90 prediction intervals are supplied.",
    "Demand levels are validation-calibrated relative bands, not probabilities.",
]

BENCHMARK_LIMITATIONS = [
    "Peer-relative percentile engine; benchmark scores are not probabilities, causal effects, or model accuracy.",
    "Limited-reliability peer groups require careful interpretation.",
]

GROWTH_LIMITATIONS = [
    "Rule- and peer-benchmark decision support; the score is not a probability or causal uplift estimate.",
    "Consequential recommendations require human review.",
]

LIQUIDITY_LIMITATIONS = [
    "Validated batch output for next calendar day only; no hourly or 6/12/24/48-hour forecast is supplied.",
    "liquidity_limit is a capacity proxy, not confirmed live cash availability.",
    "Risk bands are operational stress bands, not shortage probabilities; recommended-cash coverage is not model accuracy.",
    "Consequential financial actions require human/operator review.",
]

PERFORMANCE_LIMITATIONS = [
    "Peer-relative rule/percentile signals; no Isolation Forest or trained anomaly detector is supplied.",
    "Consequential actions require human review.",
]

LOCATION_LIMITATIONS = [
    "Relative percentile decision support, not trained ML or a probability.",
    "No real GPS coordinates or geographic geometry are supplied.",
    "Consequential expansion decisions require human review.",
]

ABNORMAL_ACTIVITY_NOTICE = (
    "Abnormal operational activity is a review signal and does not imply fraud."
)


def _number(value: str | None) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _integer(value: str | None) -> int | None:
    number = _number(value)
    return int(number) if number is not None and number.is_integer() else None


def _boolean(value: str | None) -> bool | None:
    if value is None or value == "":
        return None
    lowered = value.casefold()
    if lowered in {"true", "1", "yes"}:
        return True
    if lowered in {"false", "0", "no"}:
        return False
    return None


def _fingerprint(row: dict[str, str]) -> tuple[str, ...] | None:
    values = tuple(row.get(field, "") for field in CHURN_FEATURES)
    return values if all(value != "" for value in values) else None


@lru_cache(maxsize=1)
def _churn_by_merchant(repository: ArtifactRepository) -> dict[str, dict[str, str]]:
    features = repository.rows("merchant_features")
    predictions = repository.rows("churn")
    feature_counts = Counter(
        fingerprint
        for row in features
        if (fingerprint := _fingerprint(row)) is not None
    )
    prediction_counts = Counter(
        fingerprint
        for row in predictions
        if (fingerprint := _fingerprint(row)) is not None
    )
    prediction_by_fingerprint = {
        fingerprint: row
        for row in predictions
        if (fingerprint := _fingerprint(row)) is not None
        and prediction_counts[fingerprint] == 1
    }

    mapping: dict[str, dict[str, str]] = {}
    for row in features:
        fingerprint = _fingerprint(row)
        merchant_id = row.get("merchant_id")
        if (
            fingerprint is not None
            and merchant_id
            and feature_counts[fingerprint] == 1
            and fingerprint in prediction_by_fingerprint
        ):
            mapping[merchant_id] = prediction_by_fingerprint[fingerprint]
    return mapping


class IntelligenceService:
    def __init__(self, repository: ArtifactRepository) -> None:
        self.repository = repository

    @staticmethod
    def _metadata(
        *,
        as_of: str | None = None,
        horizon: str | None = None,
        engine: dict[str, str] | None = None,
        limitations: list[str],
    ) -> dict[str, Any]:
        metadata: dict[str, Any] = {
            "source": "synthetic",
            "synthetic_data": True,
            "serving_mode": "batch",
            "limitations": limitations,
        }
        if as_of:
            metadata["as_of"] = as_of
        if horizon:
            metadata["horizon"] = horizon
        if engine:
            metadata["model_or_engine_metadata"] = engine
        return metadata

    def _location(self, location_id: str | None) -> dict[str, str] | None:
        if not location_id:
            return None
        return self.repository.by_id("locations", "location_id", location_id)

    def merchants(
        self,
        *,
        limit: int,
        offset: int,
        merchant_category: str | None = None,
        business_size: str | None = None,
        location_id: str | None = None,
        district: str | None = None,
        status: str | None = None,
    ) -> dict[str, Any]:
        rows = sorted(self.repository.rows("merchants"), key=lambda row: row["merchant_id"])
        output = []
        for row in rows:
            location = self._location(row.get("location_id"))
            if merchant_category and row.get("merchant_category") != merchant_category:
                continue
            if business_size and row.get("business_size") != business_size:
                continue
            if location_id and row.get("location_id") != location_id:
                continue
            if district and (location is None or location.get("district") != district):
                continue
            if status and row.get("merchant_status") != status:
                continue
            output.append(self._merchant_identity(row, location))
        return self._page(output, limit, offset)

    def agents(
        self,
        *,
        limit: int,
        offset: int,
        location_id: str | None = None,
        district: str | None = None,
        agent_type: str | None = None,
        status: str | None = None,
    ) -> dict[str, Any]:
        rows = sorted(self.repository.rows("agents"), key=lambda row: row["agent_id"])
        output = []
        for row in rows:
            location = self._location(row.get("location_id"))
            if location_id and row.get("location_id") != location_id:
                continue
            if district and (location is None or location.get("district") != district):
                continue
            if agent_type and row.get("agent_type") != agent_type:
                continue
            if status and row.get("status") != status:
                continue
            output.append(self._agent_identity(row, location))
        return self._page(output, limit, offset)

    @staticmethod
    def _page(items: list[dict[str, Any]], limit: int, offset: int) -> dict[str, Any]:
        return {
            "source": "synthetic",
            "synthetic_data": True,
            "serving_mode": "batch",
            "items": items[offset : offset + limit],
            "total": len(items),
            "limit": limit,
            "offset": offset,
        }

    @staticmethod
    def _merchant_identity(
        row: dict[str, str], location: dict[str, str] | None
    ) -> dict[str, Any]:
        fields = (
            "merchant_id",
            "merchant_category",
            "business_size",
            "location_id",
            "onboarding_date",
            "qr_enabled",
            "app_enabled",
            "assigned_agent_id",
            "merchant_tenure_days",
            "merchant_status",
        )
        result = {field: row.get(field) for field in fields}
        if location:
            result["district"] = location.get("district")
            result["area_type"] = location.get("area_type")
        return result

    @staticmethod
    def _agent_identity(
        row: dict[str, str], location: dict[str, str] | None
    ) -> dict[str, Any]:
        fields = (
            "agent_id",
            "location_id",
            "agent_type",
            "onboarding_date",
            "operating_start_hour",
            "operating_end_hour",
            "agent_tenure_days",
            "status",
        )
        result = {field: row.get(field) for field in fields}
        if row.get("liquidity_limit"):
            result["liquidity_limit_capacity_proxy"] = _number(row["liquidity_limit"])
        if location:
            result["district"] = location.get("district")
            result["area_type"] = location.get("area_type")
        return result

    def merchant_identity(self, merchant_id: str) -> dict[str, Any] | None:
        row = self.repository.by_id("merchants", "merchant_id", merchant_id)
        if row is None:
            return None
        return self._merchant_identity(row, self._location(row.get("location_id")))

    def agent_identity(self, agent_id: str) -> dict[str, Any] | None:
        row = self.repository.by_id("agents", "agent_id", agent_id)
        if row is None:
            return None
        return self._agent_identity(row, self._location(row.get("location_id")))

    def demand_forecasts(
        self, *, limit: int, offset: int, merchant_category: str | None = None
    ) -> dict[str, Any]:
        rows = [
            row
            for row in self.repository.rows("demand")
            if merchant_category is None or row.get("merchant_category") == merchant_category
        ]
        rows.sort(key=lambda row: (row.get("merchant_category", ""), row.get("target_date", "")))
        projected = [self._demand_row(row) for row in rows]
        latest = max((row.get("target_date", "") for row in rows), default=None)
        config = self.repository.json("demand_config")
        return {
            **self._metadata(
                as_of=latest,
                horizon="next_day",
                engine={
                    "name": str(config.get("model_name", "Merchant Demand Forecasting")),
                    "version": str(config.get("model_version", "unknown")),
                    "model_type": str(config.get("model", "unknown")),
                    "forecast_scope": "merchant_category",
                },
                limitations=DEMAND_LIMITATIONS,
            ),
            "forecast_scope": "merchant_category",
            "items": projected[offset : offset + limit],
            "total": len(projected),
            "limit": limit,
            "offset": offset,
        }

    @staticmethod
    def _demand_row(row: dict[str, str]) -> dict[str, Any]:
        return {
            "merchant_category": row.get("merchant_category"),
            "target_date": row.get("target_date"),
            "predicted_next_day_demand": _number(row.get("predicted_next_day_demand")),
            "recent_7d_avg_demand": _number(row.get("recent_7d_avg_demand")),
            "forecast_change_percent": _number(row.get("forecast_change_percent")),
            "demand_level": row.get("demand_level"),
            "recommended_action": row.get("recommended_action"),
        }

    def merchant_forecast(self, merchant_id: str) -> dict[str, Any] | None:
        merchant = self.repository.by_id("merchants", "merchant_id", merchant_id)
        if merchant is None:
            return None
        category = merchant.get("merchant_category")
        rows = [
            row
            for row in self.repository.rows("demand")
            if row.get("merchant_category") == category
        ]
        if not rows:
            return {"merchant_id": merchant_id, "merchant_category": category, **self._demand_unavailable()}
        row = max(rows, key=lambda item: item.get("target_date", ""))
        config = self.repository.json("demand_config")
        return {
            "merchant_id": merchant_id,
            **self._demand_row(row),
            **self._metadata(
                as_of=row.get("target_date"),
                horizon="next_day",
                engine={
                    "name": str(config.get("model_name", "Merchant Demand Forecasting")),
                    "version": str(config.get("model_version", "unknown")),
                    "model_type": str(config.get("model", "unknown")),
                },
                limitations=DEMAND_LIMITATIONS,
            ),
            "forecast_scope": "merchant_category",
        }

    @staticmethod
    def _demand_unavailable() -> dict[str, Any]:
        return {
            "source": "synthetic",
            "synthetic_data": True,
            "serving_mode": "batch",
            "horizon": "next_day",
            "forecast_scope": "merchant_category",
            "limitations": DEMAND_LIMITATIONS,
            "intelligence_available": False,
        }

    def churn_risk(self, merchant_id: str) -> dict[str, Any] | None:
        if self.merchant_identity(merchant_id) is None:
            return None
        row = _churn_by_merchant(self.repository).get(merchant_id)
        if row is None:
            return {"merchant_id": merchant_id, **self._churn_unavailable()}
        predicted = _boolean(row.get("predicted_churn"))
        if predicted is None:
            return {"merchant_id": merchant_id, **self._churn_unavailable()}
        return {
            "merchant_id": merchant_id,
            "risk_result": "flagged" if predicted else "not_flagged",
            "churn_probability": _number(row.get("churn_probability")),
            "risk_level": row.get("risk_level"),
            "explanation": "Operational interpretation is the supplied 30-day inactivity prediction.",
            **self._metadata(
                horizon="30_day_inactivity",
                engine={"name": "Merchant Churn Prediction", "serving_artifact": "batch_predictions"},
                limitations=CHURN_LIMITATIONS,
            ),
        }

    @staticmethod
    def _churn_unavailable() -> dict[str, Any]:
        return {
            "source": "synthetic",
            "synthetic_data": True,
            "serving_mode": "batch",
            "horizon": "30_day_inactivity",
            "intelligence_available": False,
            "limitations": CHURN_LIMITATIONS,
        }

    def merchant_benchmark(self, merchant_id: str) -> dict[str, Any] | None:
        if self.merchant_identity(merchant_id) is None:
            return None
        row = self.repository.by_id("benchmark", "merchant_id", merchant_id)
        if row is None:
            return {"merchant_id": merchant_id, "intelligence_available": False, **self._metadata(limitations=BENCHMARK_LIMITATIONS)}
        return {
            "merchant_id": merchant_id,
            "benchmark_score": _number(row.get("benchmark_score")),
            "performance_band": row.get("benchmark_band"),
            "peer_cohort": row.get("peer_group"),
            "peer_group_size": _integer(row.get("peer_group_size")),
            "dimension_percentiles": {
                "transaction_frequency": _number(row.get("txn_percentile")),
                "transaction_value": _number(row.get("value_percentile")),
                "customer_reach": _number(row.get("customer_percentile")),
                "active_days": _number(row.get("activity_percentile")),
                "average_transaction_value": _number(row.get("ticket_size_percentile")),
            },
            "strongest_dimension": row.get("strongest_dimension"),
            "improvement_dimension": row.get("weakest_dimension"),
            "reliability_level": row.get("benchmark_reliability"),
            "insight": row.get("benchmark_insight"),
            "recommended_action": row.get("recommended_action"),
            **self._metadata(
                engine={"name": "Merchant Benchmarking", "type": "peer_relative_percentile_engine"},
                limitations=BENCHMARK_LIMITATIONS,
            ),
        }

    def merchant_recommendation(self, merchant_id: str) -> dict[str, Any] | None:
        if self.merchant_identity(merchant_id) is None:
            return None
        row = self.repository.by_id("growth", "merchant_id", merchant_id)
        if row is None:
            return {"merchant_id": merchant_id, "intelligence_available": False, **self._metadata(limitations=GROWTH_LIMITATIONS)}
        return {
            "merchant_id": merchant_id,
            "growth_opportunity_score": _number(row.get("growth_opportunity_score")),
            "growth_priority": row.get("growth_priority"),
            "recommendation_type": row.get("recommendation_type"),
            "recommended_action": row.get("recommended_action"),
            "recommendation_reason": row.get("recommendation_reason"),
            "peer_context": {
                "transaction_ratio": _number(row.get("txn_peer_ratio")),
                "value_ratio": _number(row.get("value_peer_ratio")),
                "customer_ratio": _number(row.get("customer_peer_ratio")),
                "activity_ratio": _number(row.get("activity_peer_ratio")),
            },
            "inactivity_context": {
                "days_since_last_txn": _integer(row.get("days_since_last_txn")),
                "inactivity_level": row.get("inactivity_level"),
            },
            **self._metadata(
                engine={"name": "Merchant Growth Recommendation", "type": "rule_peer_benchmark_engine"},
                limitations=GROWTH_LIMITATIONS,
            ),
        }

    def merchant_overview(self, merchant_id: str) -> dict[str, Any] | None:
        identity = self.merchant_identity(merchant_id)
        if identity is None:
            return None
        return {
            "identity": identity,
            "demand_context": self.merchant_forecast(merchant_id),
            "churn_context": self.churn_risk(merchant_id),
            "benchmark_context": self.merchant_benchmark(merchant_id),
            "growth_context": self.merchant_recommendation(merchant_id),
            "source": "synthetic",
            "synthetic_data": True,
            "serving_mode": "batch",
        }

    def liquidity_forecast(
        self,
        agent_id: str,
        target_date: date | None = None,
        *,
        horizon: str = "next_day",
    ) -> dict[str, Any] | None:
        if self.agent_identity(agent_id) is None:
            return None
        rows = [
            row
            for row in self.repository.rows("liquidity")
            if row.get("agent_id") == agent_id
            and (target_date is None or row.get("target_date") == target_date.isoformat())
        ]
        if not rows:
            return {"agent_id": agent_id, "intelligence_available": False, **self._metadata(horizon="next_day", engine={"name": "Agent Liquidity Intelligence", "version": "2.0-cleaned-next-day"}, limitations=LIQUIDITY_LIMITATIONS)}
        row = max(rows, key=lambda item: item.get("target_date", ""))
        config = self.repository.json("liquidity_config")
        return {
            "agent_id": agent_id,
            "horizon": horizon,
            "predicted_next_day_cashout": _number(row.get("predicted_next_day_cashout")),
            "recommended_cash": _number(row.get("recommended_cash")),
            "liquidity_limit_capacity_proxy": _number(row.get("liquidity_limit")),
            "liquidity_stress_percent": _number(row.get("liquidity_stress_percent")),
            "risk_level": row.get("risk_level"),
            "recommended_action": row.get("recommended_action"),
            "as_of": row.get("date"),
            "target_date": row.get("target_date"),
            **self._metadata(
                as_of=row.get("date"),
                horizon=horizon,
                engine={
                    "name": str(config.get("model_name", "Agent Liquidity Intelligence")),
                    "version": str(config.get("version", "2.0-cleaned-next-day")),
                    "model_type": str(config.get("model_type", "LightGBM Regressor")),
                    "feature_count": len(config.get("features", [])),
                },
                limitations=LIQUIDITY_LIMITATIONS,
            ),
        }

    def agent_performance(self, agent_id: str) -> dict[str, Any] | None:
        if self.agent_identity(agent_id) is None:
            return None
        row = self.repository.by_id("agent_performance", "agent_id", agent_id)
        if row is None:
            return {"agent_id": agent_id, "intelligence_available": False, **self._metadata(limitations=PERFORMANCE_LIMITATIONS)}
        return {
            "agent_id": agent_id,
            "performance_score": _number(row.get("performance_score")),
            "performance_band": row.get("performance_band"),
            "momentum_score": _number(row.get("momentum_score")),
            "emerging_high_performer": _boolean(row.get("emerging_high_performer")),
            "declining": _boolean(row.get("declining_agent")),
            "service_gap": _boolean(row.get("service_gap_flag")),
            "service_gap_score": _number(row.get("service_gap_score")),
            "primary_strength": row.get("primary_strength"),
            "primary_improvement_area": row.get("primary_improvement_area"),
            "recommended_action": row.get("recommended_action"),
            "reason": row.get("recommendation_reason"),
            **self._metadata(
                engine={"name": "Agent Performance Intelligence", "type": "peer_relative_percentile_engine"},
                limitations=PERFORMANCE_LIMITATIONS,
            ),
        }

    def agent_anomalies(self, agent_id: str) -> dict[str, Any] | None:
        if self.agent_identity(agent_id) is None:
            return None
        row = self.repository.by_id("agent_performance", "agent_id", agent_id)
        flags = []
        if row:
            for field, code in (
                ("abnormal_high_activity", "abnormal_high_activity"),
                ("abnormal_low_activity", "abnormal_low_activity"),
                ("abnormal_pattern_flag", "abnormal_pattern"),
            ):
                if _boolean(row.get(field)) is True:
                    flags.append(code)
        return {
            "agent_id": agent_id,
            "flags": flags,
            "review_signal": bool(flags),
            "statement": ABNORMAL_ACTIVITY_NOTICE,
            **self._metadata(
                engine={"name": "Agent Performance Intelligence", "type": "peer_relative_operational_flags"},
                limitations=PERFORMANCE_LIMITATIONS,
            ),
        }

    def agent_overview(self, agent_id: str) -> dict[str, Any] | None:
        identity = self.agent_identity(agent_id)
        if identity is None:
            return None
        return {
            "identity": identity,
            "liquidity_context": self.liquidity_forecast(agent_id),
            "performance_context": self.agent_performance(agent_id),
            "operational_review_context": self.agent_anomalies(agent_id),
            "source": "synthetic",
            "synthetic_data": True,
            "serving_mode": "batch",
        }

    def location_opportunities(
        self,
        *,
        limit: int,
        offset: int,
        district: str | None = None,
        area_type: str | None = None,
        expansion_priority: str | None = None,
        recommended_expansion: str | None = None,
    ) -> dict[str, Any]:
        rows = self.repository.rows("location_intelligence")
        filtered = [
            row
            for row in rows
            if (district is None or row.get("district") == district)
            and (area_type is None or row.get("area_type") == area_type)
            and (expansion_priority is None or row.get("expansion_priority") == expansion_priority)
            and (recommended_expansion is None or row.get("recommended_expansion") == recommended_expansion)
        ]
        filtered.sort(key=lambda row: row.get("location_id", ""))
        items = [
            {
                "location_id": row.get("location_id"),
                "district": row.get("district"),
                "area_type": row.get("area_type"),
                "demand_opportunity_score": _number(row.get("demand_opportunity_score")),
                "merchant_coverage_pressure": _number(row.get("merchant_coverage_pressure")),
                "agent_coverage_pressure": _number(row.get("agent_coverage_pressure")),
                "structural_opportunity_score": _number(row.get("structural_opportunity_score")),
                "merchant_expansion_score": _number(row.get("merchant_expansion_score")),
                "agent_expansion_score": _number(row.get("agent_expansion_score")),
                "location_opportunity_score": _number(row.get("location_opportunity_score")),
                "expansion_priority": row.get("expansion_priority"),
                "recommended_expansion": row.get("recommended_expansion"),
                "recommendation_reason": row.get("recommendation_reason"),
                "recommended_action": row.get("recommended_action"),
            }
            for row in filtered
        ]
        return {
            **self._metadata(
                engine={"name": "Location Intelligence", "type": "percentile_decision_support_engine"},
                limitations=LOCATION_LIMITATIONS,
            ),
            "items": items[offset : offset + limit],
            "total": len(items),
            "limit": limit,
            "offset": offset,
        }