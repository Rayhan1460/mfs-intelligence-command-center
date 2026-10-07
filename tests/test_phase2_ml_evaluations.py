"""
tests/test_phase2_ml_evaluations.py
Comprehensive test suite validating Phase 2 ML models, baselines, and governance:
- Forward churn label & zero future leakage verification
- Threshold analysis and metrics integrity
- Demand forecast baselines and empirical residual interval coverage
- Liquidity P90 coverage, pinball loss, and shortfall proxy definitions
- Agent underperformance classifier performance
- Operations queue consumption of new forward models
- Model registry metadata and peer engine specifications
- Copilot 30-case grounded evaluation file integrity
"""

import json
from pathlib import Path
import pytest
from app.domains.operations.service import OperationsService
from app.domains.registry.router import MODEL_REGISTRY
from app.repositories.artifacts import get_artifact_repository

REPO_ROOT = Path(__file__).resolve().parents[1]


def test_forward_churn_label_and_no_leakage():
    manifest_path = REPO_ROOT / "ml" / "churn" / "feature_manifest.json"
    assert manifest_path.exists(), "feature_manifest.json must exist"
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # Cutoffs must be chronological and strictly separated
    splits = manifest["split_summary"]
    t_train = splits["train"]["cutoff_date"]
    t_val = splits["val"]["cutoff_date"]
    t_test = splits["test"]["cutoff_date"]
    t_score = splits["score"]["cutoff_date"]

    assert t_train < t_val < t_test <= t_score
    assert manifest["canonical_merchants_count"] == 5000
    assert "target_churn_30d_forward" not in manifest["feature_list"]
    assert "days_since_last_txn" in manifest["feature_list"]


def test_forward_churn_metrics_and_threshold():
    metrics_path = REPO_ROOT / "ml" / "churn" / "metrics.json"
    assert metrics_path.exists()
    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)

    test_perf = metrics["test_performance"]
    assert test_perf["roc_auc"] > 0.80
    assert test_perf["pr_auc"] > 0.35
    assert test_perf["chosen_threshold"] == 0.35
    assert test_perf["chosen_metrics"]["recall"] > 0.80  # high capture for operations
    assert "confusion_matrix" in test_perf["chosen_metrics"]
    assert metrics["coverage"]["canonical_merchants"] == 5000
    assert len(metrics["top_features"]) >= 5


def test_demand_baseline_evaluation_and_intervals():
    demand_eval_path = REPO_ROOT / "ml" / "demand" / "demand_evaluation.json"
    assert demand_eval_path.exists()
    with open(demand_eval_path, "r", encoding="utf-8") as f:
        demand = json.load(f)

    overall = demand["overall_evaluation"]
    baselines = overall["baselines"]
    assert "previous_day_naive" in baselines
    assert "rolling_7d_average" in baselines
    assert "seasonal_naive_7d" in baselines

    # Residual prediction interval coverage
    intervals = demand["uncertainty_intervals"]
    assert intervals["is_statistically_supportable"] is True
    # Empirical coverage of central 80% interval [P10, P90] should be within 75%-85%
    assert 75.0 <= intervals["empirical_coverage_percent"] <= 85.0
    assert demand["ui_governance"]["display_label"] == "CATEGORY DEMAND OUTLOOK"


def test_liquidity_p90_coverage_and_pinball_loss():
    liq_eval_path = REPO_ROOT / "ml" / "liquidity" / "liquidity_evaluation.json"
    assert liq_eval_path.exists()
    with open(liq_eval_path, "r", encoding="utf-8") as f:
        liq = json.load(f)

    # Point forecast honesty
    point = liq["point_forecast_honesty"]
    assert point["r2"] < 0.05  # transparently acknowledges weak point accuracy
    assert "weak" in point["honest_verdict"].lower()

    # Operational P90 buffer evaluation
    p90 = liq["p90_operational_buffer_evaluation"]
    assert 88.0 <= p90["empirical_p90_coverage_percent"] <= 92.0  # calibrated around target 90%
    assert p90["p90_pinball_loss"] > 0
    assert p90["shortfall_proxy_events"] > 0
    assert liq["ui_terminology"]["stockout_label"] == "LIQUIDITY SHORTFALL PROXY"


def test_agent_underperformance_model_metrics():
    underperf_path = REPO_ROOT / "ml" / "agent_underperformance" / "metrics.json"
    assert underperf_path.exists()
    with open(underperf_path, "r", encoding="utf-8") as f:
        underperf = json.load(f)

    test_perf = underperf["test_performance"]
    assert test_perf["roc_auc"] > 0.90
    assert test_perf["pr_auc"] > 0.70
    assert test_perf["recall"] > 0.80
    assert test_perf["chosen_threshold"] == 0.40
    assert len(underperf["top_features"]) >= 5


def test_operations_queue_uses_forward_churn_and_underperformance():
    repo = get_artifact_repository()
    service = OperationsService(repo)
    priorities = service.get_candidate_priorities()
    assert len(priorities) > 0

    reasons = [p.reason for p in priorities]
    # Verify forward churn or forward underperformance signals are present
    has_forward_churn = any("forward" in r.lower() or "inactivity" in r.lower() for r in reasons)
    has_underperformance_or_liq = any("liquidity" in r.lower() or "service gap" in r.lower() or "underperformance" in r.lower() for r in reasons)

    assert has_forward_churn
    assert has_underperformance_or_liq

    # Verify liquidity confidence label is calibrated P90 buffer, not "high quality"
    for p in priorities:
        if "liquidity" in p.source_modules and "agent" in p.entity_type:
            assert "p90 operational buffer" in p.confidence_label.lower()
            assert "weak" in p.confidence_label.lower()


def test_model_registry_metadata_and_peer_engines():
    models = {m["capability"]: m for m in MODEL_REGISTRY}
    models.update({m["display_title"]: m for m in MODEL_REGISTRY if "display_title" in m})
    assert "Forward-Looking Merchant Churn Prediction" in models
    assert "Agent Performance & Underperformance Intelligence" in models
    assert "Merchant Category Demand Forecasting" in models
    assert "Agent Liquidity Intelligence" in models
    assert "Merchant Benchmarking" in models

    # Check peer engine explicit logic
    bench = models["Merchant Benchmarking"]
    assert bench["engine_type"] == "PERCENTILE ENGINE"
    assert "peer_grouping_columns" in bench
    assert "peer_group_size" in bench
    assert "percentile_definition" in bench
    assert "fallback_behavior" in bench


def test_copilot_evaluation_integrity():
    cases_path = REPO_ROOT / "evaluation" / "copilot_cases.json"
    results_path = REPO_ROOT / "evaluation" / "copilot_results.json"
    assert cases_path.exists()
    assert results_path.exists()

    with open(cases_path, "r", encoding="utf-8") as f:
        cases = json.load(f)
    assert len(cases) == 30

    with open(results_path, "r", encoding="utf-8") as f:
        results = json.load(f)

    metrics = results["metrics"]
    assert metrics["grounded_answer_pass_rate_percent"] == 100.0
    assert metrics["unsupported_refusal_pass_rate_percent"] == 100.0
    assert metrics["entity_id_consistency_rate_percent"] >= 85.0
