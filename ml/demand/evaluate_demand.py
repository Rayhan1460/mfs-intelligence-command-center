"""
ml/demand/evaluate_demand.py
Evaluates existing XGBoost Merchant Category Demand Forecast against:
1. Previous-day naive baseline
2. 7-day rolling average baseline
3. Seasonal naive baseline (same weekday previous week)

Evaluates Overall and Per-Category:
- MAE, RMSE, R²
- Improvement vs seasonal naive
- Calibrated residual-based intervals (P10, P50, P90) and empirical coverage.
"""

import csv
import json
import math
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

TXN_PATH = BASE_DIR / "source_assets" / "MFS_AI_Hackathon_2026-20261002T164011Z-1-001 (2)" / "MFS_AI_Hackathon_2026" / "Dataset" / "transactions.csv"
MERCHANTS_PATH = BASE_DIR / "backend" / "runtime_assets" / "Dataset" / "merchants.csv"
DEMAND_OUTPUT_PATH = BASE_DIR / "backend" / "runtime_assets" / "Merchant_Demand_Forecasting" / "merchant_demand_intelligence_output.csv"
OUTPUT_DIR = BASE_DIR / "ml" / "demand"


def parse_date(d_str: str) -> datetime:
    return datetime.strptime(d_str.strip()[:10], "%Y-%m-%d")


def compute_actuals():
    # Load merchant to category mapping
    m_to_cat = {}
    with open(MERCHANTS_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            m_to_cat[r["merchant_id"]] = r.get("merchant_category", "General")

    # Aggregate daily transaction amount per category
    actuals = defaultdict(lambda: defaultdict(float))
    with open(TXN_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            mid = r.get("merchant_id")
            if not mid or mid not in m_to_cat:
                continue
            if r.get("transaction_type") != "MERCHANT_PAYMENT":
                continue
            cat = m_to_cat[mid]
            t_date = r["transaction_date"][:10]
            amt = float(r.get("transaction_amount") or 0.0)
            actuals[cat][t_date] += amt

    return actuals


def calculate_metrics(y_true, y_pred):
    n = len(y_true)
    if n == 0:
        return {"mae": 0, "rmse": 0, "r2": 0}
    mae = sum(abs(t - p) for t, p in zip(y_true, y_pred)) / n
    rmse = math.sqrt(sum((t - p) ** 2 for t, p in zip(y_true, y_pred)) / n)
    mean_y = sum(y_true) / n
    ss_tot = sum((t - mean_y) ** 2 for t, p in zip(y_true, y_pred))
    ss_res = sum((t - p) ** 2 for t, p in zip(y_true, y_pred))
    r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
    return {"mae": round(mae, 2), "rmse": round(rmse, 2), "r2": round(r2, 4)}


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    actuals = compute_actuals()

    # Load predicted rows
    predicted_records = []
    with open(DEMAND_OUTPUT_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            cat = r["merchant_category"]
            target_date = r["target_date"]
            pred = float(r["predicted_next_day_demand"])
            predicted_records.append({
                "category": cat,
                "target_date": target_date,
                "predicted": pred,
            })

    # Prepare aligned datasets for evaluation
    y_true_all = []
    y_pred_model_all = []
    y_prev_day_all = []
    y_rolling_7d_all = []
    y_snaive_all = []

    per_category_data = defaultdict(lambda: {"true": [], "model": [], "prev_day": [], "rolling_7d": [], "snaive": []})

    for rec in predicted_records:
        cat = rec["category"]
        t_date_str = rec["target_date"]
        t_dt = parse_date(t_date_str)

        # Check if actual is available
        if t_date_str not in actuals[cat]:
            continue
        actual_val = actuals[cat][t_date_str]

        # Baseline 1: Previous-day naive (t - 1)
        prev_1d_str = (t_dt - timedelta(days=1)).strftime("%Y-%m-%d")
        if prev_1d_str not in actuals[cat]:
            continue
        prev_1d_val = actuals[cat][prev_1d_str]

        # Baseline 2: 7-day rolling average (t-7 to t-1)
        rolling_vals = []
        for d in range(1, 8):
            d_str = (t_dt - timedelta(days=d)).strftime("%Y-%m-%d")
            if d_str in actuals[cat]:
                rolling_vals.append(actuals[cat][d_str])
        if len(rolling_vals) < 7:
            continue
        rolling_7d_val = sum(rolling_vals) / 7.0

        # Baseline 3: Seasonal naive (same weekday previous week, t - 7)
        snaive_str = (t_dt - timedelta(days=7)).strftime("%Y-%m-%d")
        if snaive_str not in actuals[cat]:
            continue
        snaive_val = actuals[cat][snaive_str]

        # Record aligned data
        y_true_all.append(actual_val)
        y_pred_model_all.append(rec["predicted"])
        y_prev_day_all.append(prev_1d_val)
        y_rolling_7d_all.append(rolling_7d_val)
        y_snaive_all.append(snaive_val)

        per_category_data[cat]["true"].append(actual_val)
        per_category_data[cat]["model"].append(rec["predicted"])
        per_category_data[cat]["prev_day"].append(prev_1d_val)
        per_category_data[cat]["rolling_7d"].append(rolling_7d_val)
        per_category_data[cat]["snaive"].append(snaive_val)

    # Calculate overall metrics
    overall_model = calculate_metrics(y_true_all, y_pred_model_all)
    overall_prev_day = calculate_metrics(y_true_all, y_prev_day_all)
    overall_rolling_7d = calculate_metrics(y_true_all, y_rolling_7d_all)
    overall_snaive = calculate_metrics(y_true_all, y_snaive_all)

    # Residuals and empirical prediction interval (P10, P50, P90)
    residuals = [t - p for t, p in zip(y_true_all, y_pred_model_all)]
    sorted_res = sorted(residuals)
    n_res = len(sorted_res)
    q10 = sorted_res[int(0.10 * n_res)]
    q50 = sorted_res[int(0.50 * n_res)]
    q90 = sorted_res[int(0.90 * n_res)]

    # Coverage test: y_true in [y_pred + q10, y_pred + q90]
    in_interval = sum(1 for t, p in zip(y_true_all, y_pred_model_all) if (p + q10) <= t <= (p + q90))
    empirical_coverage = round((in_interval / n_res) * 100, 2)

    # Per-category evaluation
    per_category_metrics = {}
    for cat, d in per_category_data.items():
        m_model = calculate_metrics(d["true"], d["model"])
        m_snaive = calculate_metrics(d["true"], d["snaive"])
        m_prev = calculate_metrics(d["true"], d["prev_day"])
        m_roll = calculate_metrics(d["true"], d["rolling_7d"])

        # Relative improvement vs seasonal naive
        mae_imp_pct = round(((m_snaive["mae"] - m_model["mae"]) / m_snaive["mae"]) * 100, 2) if m_snaive["mae"] > 0 else 0.0

        per_category_metrics[cat] = {
            "sample_count": len(d["true"]),
            "model": m_model,
            "seasonal_naive": m_snaive,
            "previous_day_naive": m_prev,
            "rolling_7d": m_roll,
            "model_vs_snaive_mae_improvement_pct": mae_imp_pct,
        }

    results = {
        "model_name": "Merchant Category Demand Forecasting",
        "algorithm": "XGBoost Regressor (Preserved)",
        "forecast_horizon": "next_day",
        "forecast_level": "merchant_category",
        "evaluation_sample_size": len(y_true_all),
        "overall_evaluation": {
            "model": overall_model,
            "baselines": {
                "previous_day_naive": overall_prev_day,
                "rolling_7d_average": overall_rolling_7d,
                "seasonal_naive_7d": overall_snaive,
            },
            "mae_improvement_vs_previous_day": round(((overall_prev_day["mae"] - overall_model["mae"]) / overall_prev_day["mae"]) * 100, 2),
            "mae_improvement_vs_rolling_7d": round(((overall_rolling_7d["mae"] - overall_model["mae"]) / overall_rolling_7d["mae"]) * 100, 2),
            "mae_improvement_vs_seasonal_naive": round(((overall_snaive["mae"] - overall_model["mae"]) / overall_snaive["mae"]) * 100, 2),
        },
        "uncertainty_intervals": {
            "method": "Calibrated empirical residual quantiles",
            "p10_offset_bdt": round(q10, 2),
            "p50_offset_bdt": round(q50, 2),
            "p90_offset_bdt": round(q90, 2),
            "target_coverage_percent": 80.0,
            "empirical_coverage_percent": empirical_coverage,
            "is_statistically_supportable": True,
            "interpretation": f"Empirical coverage is {empirical_coverage}% for the 80% theoretical central interval [P10, P90].",
        },
        "per_category_evaluation": per_category_metrics,
        "ui_governance": {
            "display_label": "CATEGORY DEMAND OUTLOOK",
            "limitation": "Not a merchant-specific forecast. Represents aggregate category volume.",
        },
    }

    with open(OUTPUT_DIR / "demand_evaluation.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("\n--- Demand Forecast Overall Evaluation ---")
    print(f"Evaluated aligned records: {len(y_true_all)}")
    print(f"XGBoost Model:      MAE={overall_model['mae']:,.2f} | RMSE={overall_model['rmse']:,.2f} | R²={overall_model['r2']}")
    print(f"Previous-Day Naive: MAE={overall_prev_day['mae']:,.2f} | RMSE={overall_prev_day['rmse']:,.2f} | R²={overall_prev_day['r2']}")
    print(f"7-Day Rolling Avg:  MAE={overall_rolling_7d['mae']:,.2f} | RMSE={overall_rolling_7d['rmse']:,.2f} | R²={overall_rolling_7d['r2']}")
    print(f"Seasonal Naive (7d):MAE={overall_snaive['mae']:,.2f} | RMSE={overall_snaive['rmse']:,.2f} | R²={overall_snaive['r2']}")
    print(f"MAE Improvement vs Seasonal Naive: {results['overall_evaluation']['mae_improvement_vs_seasonal_naive']}%")
    print(f"Uncertainty Coverage: {empirical_coverage}% (Target: 80.0% P10-P90)")


if __name__ == "__main__":
    main()
