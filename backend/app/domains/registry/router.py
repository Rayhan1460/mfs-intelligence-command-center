from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.security.audit import record_audit_event
from app.security.dependencies import require_roles

router = APIRouter()

MODEL_REGISTRY = [
    {
        "capability": "Merchant Demand Forecasting",
        "engine_type": "ML: XGBoost Regressor",
        "serving_mode": "batch",
        "horizon": "next_day",
        "forecast_scope": "merchant_category",
        "artifact": "merchant_demand_intelligence_output.csv",
        "version": "1.0",
        "documented_metrics": {
            "test_samples": 390,
            "test_period": {"start": "2026-08-23", "end": "2026-09-30"},
            "mae": 9834.678687099358,
            "rmse": 12827.8096717228,
            "r2": 0.7723968453935751,
            "correlation": 0.8811679369152751,
            "baseline_7d_mae": 10127.41297069597,
            "mae_improvement_percent": 2.8905139391831756,
        },
        "limitations": [
            "Category-level next-day point forecast, not merchant-specific or hourly.",
            "No P50/P90 intervals are supplied.",
            "Demand bands are validation-calibrated relative bands, not probabilities.",
        ],
        "synthetic_data": True,
    },
    {
        "capability": "Merchant Churn Prediction",
        "engine_type": "ML: sklearn Pipeline with LightGBM classifier",
        "serving_mode": "batch",
        "horizon": "30_day_inactivity",
        "artifact": "merchant_churn_predictions.csv",
        "version": None,
        "documented_metrics": {
            "accuracy": 1.0,
            "precision": 1.0,
            "recall": 1.0,
            "f1": 1.0,
            "roc_auc": 1.0,
            "pr_auc": 1.0,
        },
        "limitations": [
            "Operational interpretation is 30-day inactivity risk.",
            "The supplied label is deterministic from days_since_last_txn >= 30; documented 1.0 metrics do not establish generalizable real-world performance.",
            "Only supplied Low and Critical risk levels are returned.",
            "Only unique exact merchant-ID feature matches are served; unmatched merchants remain unavailable.",
        ],
        "synthetic_data": True,
    },
    {
        "capability": "Merchant Benchmarking",
        "engine_type": "Peer-relative percentile engine",
        "serving_mode": "batch",
        "horizon": "snapshot",
        "artifact": "merchant_benchmark_intelligence_output.csv",
        "version": None,
        "documented_metrics": {
            "merchants": 5000,
            "mean_benchmark_score": 50.4,
            "reliability_high": 4792,
            "reliability_moderate": 105,
            "reliability_limited": 103,
        },
        "limitations": [
            "Peer-relative percentile engine, not trained ML.",
            "Scores are not probabilities, causal effects, or model accuracy.",
        ],
        "synthetic_data": True,
    },
    {
        "capability": "Merchant Growth Recommendation",
        "engine_type": "Rule and peer-benchmark recommendation engine",
        "serving_mode": "batch",
        "horizon": "snapshot",
        "artifact": "merchant_growth_intelligence_output.csv",
        "version": None,
        "documented_metrics": {
            "merchants": 5000,
            "history_available": 4848,
            "insufficient_history": 152,
            "priority_low": 2498,
            "priority_medium": 1252,
            "priority_high": 684,
            "priority_critical": 566,
        },
        "limitations": [
            "Rule/peer decision support, not trained predictive ML.",
            "Growth score is not a probability or causal uplift estimate.",
            "Consequential recommendations require human review.",
        ],
        "synthetic_data": True,
    },
    {
        "capability": "Agent Liquidity Intelligence",
        "engine_type": "ML: LightGBM Regressor with calibrated operational stress bands",
        "serving_mode": "batch",
        "horizon": "next_day",
        "artifact": "agent_liquidity_intelligence_output.csv",
        "version": "2.0-cleaned-next-day",
        "documented_metrics": {
            "test_samples": 12102,
            "test_mae": 1455.4535692640663,
            "test_rmse": 2747.8600943393994,
            "test_r2": -0.00949021684101603,
            "baseline_7d_mae": 1465.1467989942628,
            "recommended_cash_coverage_percent": 89.92728474632293,
        },
        "limitations": [
            "Next calendar day only; no hourly or 6/12/24/48-hour paths.",
            "liquidity_limit is a capacity proxy, not live cash.",
            "Risk bands are not shortage probabilities; recommended-cash coverage is not accuracy.",
            "Weak test R-squared; consequential financial actions require human review.",
        ],
        "synthetic_data": True,
    },
    {
        "capability": "Agent Performance Intelligence",
        "engine_type": "Rule/percentile engine",
        "serving_mode": "batch",
        "horizon": "recent_30_day_snapshot",
        "artifact": "agent_performance_intelligence_output.csv",
        "version": None,
        "documented_metrics": {
            "agents": 800,
            "emerging_high_performers": 96,
            "declining_agents": 193,
            "service_gap_flags": 80,
            "abnormal_pattern_flags": 15,
        },
        "limitations": [
            "Peer-relative operational flags; no Isolation Forest or trained anomaly detector is supplied.",
            "Abnormal activity is not fraud detection.",
            "Consequential actions require human review.",
        ],
        "synthetic_data": True,
    },
    {
        "capability": "Location Intelligence",
        "engine_type": "Percentile decision-support engine",
        "serving_mode": "batch",
        "horizon": "observed_aggregate_window",
        "artifact": "location_intelligence_output.csv",
        "version": None,
        "documented_metrics": {
            "locations": 120,
            "priority_low": 60,
            "priority_medium": 30,
            "priority_high": 18,
            "priority_critical": 12,
        },
        "limitations": [
            "Relative opportunity index, not trained ML or probability.",
            "No real GPS coordinates or geometry are supplied.",
            "CRITICAL is relative opportunity, not an emergency; expansion requires human review.",
        ],
        "synthetic_data": True,
    },
]


@router.get("/models")
def list_models(
    request: Request,
    user=Depends(require_roles("ADMIN", "JUDGE")),
    session: Session = Depends(get_db),
):
    if user.role == "ADMIN":
        record_audit_event(
            session,
            event_type="PRIVILEGED_ACCESS",
            actor_user_id=user.id,
            subject_type="model_registry",
            subject_id="all",
            correlation_id=getattr(request.state, "correlation_id", None),
            metadata={"operation": "read"},
        )
        session.commit()
    return {"items": MODEL_REGISTRY, "total": len(MODEL_REGISTRY)}