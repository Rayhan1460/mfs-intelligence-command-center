"""
ml/agent_underperformance/train_underperformance.py
Trains and evaluates the Agent Underperformance / Service Gap Classifier.

Definition:
- Given agent operational history strictly on or before cutoff date T,
  predict whether the agent enters an underperformance / service gap state
  in the forward 30-day evaluation window (T, T + 30d].
- Underperformance / Service Gap:
  Active transaction days < 5 OR transaction volume in bottom 20th percentile.
- Time-aware splits:
  Train: Cutoff 2026-05-31
  Val:   Cutoff 2026-06-30
  Test:  Cutoff 2026-07-31
  Score: Cutoff 2026-08-31
"""

import csv
import json
import math
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
import joblib
import numpy as np

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
import lightgbm as lgb
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    precision_recall_fscore_support,
    confusion_matrix,
)

BASE_DIR = Path(__file__).resolve().parents[2]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

TXN_PATH = BASE_DIR / "source_assets" / "MFS_AI_Hackathon_2026-20261002T164011Z-1-001 (2)" / "MFS_AI_Hackathon_2026" / "Dataset" / "transactions.csv"
AGENTS_PATH = BASE_DIR / "backend" / "runtime_assets" / "Dataset" / "agents.csv"
OUTPUT_DIR = BASE_DIR / "ml" / "agent_underperformance"
RUNTIME_OUTPUT_DIR = BASE_DIR / "backend" / "runtime_assets" / "Agent_Performance_Intelligence"

FEATURE_NAMES = [
    "agent_type_encoded",
    "tenure_days",
    "txn_count_30d",
    "txn_count_7d",
    "txn_value_30d",
    "txn_value_7d",
    "commission_30d",
    "active_days_30d",
    "success_rate_30d",
    "txn_velocity_ratio",
    "value_velocity_ratio",
]

AGENT_TYPE_MAP = {
    "Retail": 0,
    "Dedicated": 1,
    "Super Agent": 2,
    "Standard": 0,
}


def parse_date(d_str: str) -> datetime:
    return datetime.strptime(d_str.strip()[:10], "%Y-%m-%d")


def load_agents():
    agents = {}
    with open(AGENTS_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            agents[r["agent_id"]] = {
                "agent_id": r["agent_id"],
                "agent_type": r.get("agent_type", "Standard"),
                "status": r.get("status", "Active"),
                "onboarding_date": parse_date(r["onboarding_date"]) if r.get("onboarding_date") else datetime(2025, 1, 1),
            }
    return agents


def load_transactions():
    txns = []
    with open(TXN_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            aid = r.get("agent_id")
            if not aid:
                continue
            txns.append({
                "agent_id": aid,
                "date": parse_date(r["transaction_date"]),
                "amount": float(r.get("transaction_amount") or 0.0),
                "commission": float(r.get("commission_amount") or 0.0),
                "status": r.get("transaction_status", "SUCCESS").upper(),
            })
    return txns


def build_split(cutoff: datetime, agents: dict, transactions: list):
    cutoff_str = cutoff.strftime("%Y-%m-%d")
    w7 = cutoff - timedelta(days=7)
    w30 = cutoff - timedelta(days=30)
    forward_30 = cutoff + timedelta(days=30)

    past_by_a = defaultdict(list)
    fwd_by_a = defaultdict(list)

    for t in transactions:
        aid = t["agent_id"]
        if aid not in agents:
            continue
        if t["date"] <= cutoff:
            past_by_a[aid].append(t)
        elif t["date"] <= forward_30:
            fwd_by_a[aid].append(t)

    # First pass: collect forward volumes to determine bottom 20th percentile threshold
    fwd_vols = [sum(t["amount"] for t in fwd_by_a[aid]) for aid in agents]
    p20_vol = float(np.percentile(fwd_vols, 20))

    rows = []
    for aid, a in agents.items():
        tenure = max(1, (cutoff - a["onboarding_date"]).days)
        past = past_by_a[aid]

        past_7d = [t for t in past if t["date"] > w7]
        past_30d = [t for t in past if t["date"] > w30]

        count_7d = len(past_7d)
        count_30d = len(past_30d)
        val_7d = sum(t["amount"] for t in past_7d)
        val_30d = sum(t["amount"] for t in past_30d)
        comm_30d = sum(t["commission"] for t in past_30d)
        act_days_30d = len(set(t["date"] for t in past_30d))

        succ_30d = sum(1 for t in past_30d if t["status"] == "SUCCESS")
        succ_rate_30d = succ_30d / count_30d if count_30d > 0 else 1.0

        txn_vel = count_7d / ((count_30d / 4.0) + 1e-4)
        val_vel = val_7d / ((val_30d / 4.0) + 1e-4)

        # Forward target
        fwd = fwd_by_a[aid]
        fwd_act_days = len(set(t["date"] for t in fwd))
        fwd_vol = sum(t["amount"] for t in fwd)

        # Underperformance definition: < 5 active days OR bottom 20% volume
        is_underperforming = 1 if (fwd_act_days < 5 or fwd_vol <= p20_vol) else 0

        feat_vector = [
            AGENT_TYPE_MAP.get(a["agent_type"], 0),
            tenure,
            count_30d,
            count_7d,
            val_30d,
            val_7d,
            comm_30d,
            act_days_30d,
            succ_rate_30d,
            txn_vel,
            val_vel,
        ]

        rows.append({
            "agent_id": aid,
            "cutoff_date": cutoff_str,
            "features": feat_vector,
            "target": is_underperforming,
        })

    return rows


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    agents = load_agents()
    txns = load_transactions()

    print("Building temporal splits for Agent Underperformance...")
    train_data = build_split(datetime(2026, 5, 31), agents, txns)
    val_data = build_split(datetime(2026, 6, 30), agents, txns)
    test_data = build_split(datetime(2026, 7, 31), agents, txns)
    score_data = build_split(datetime(2026, 8, 31), agents, txns)

    X_train = np.array([r["features"] for r in train_data], dtype=np.float32)
    y_train = np.array([r["target"] for r in train_data], dtype=np.int32)

    X_val = np.array([r["features"] for r in val_data], dtype=np.float32)
    y_val = np.array([r["target"] for r in val_data], dtype=np.int32)

    X_test = np.array([r["features"] for r in test_data], dtype=np.float32)
    y_test = np.array([r["target"] for r in test_data], dtype=np.int32)

    X_score = np.array([r["features"] for r in score_data], dtype=np.float32)
    score_ids = [r["agent_id"] for r in score_data]

    # Models comparison
    models = {
        "Logistic Regression": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(max_iter=1000, random_state=42, class_weight="balanced")),
        ]),
        "Random Forest": RandomForestClassifier(
            n_estimators=100, max_depth=6, random_state=42, class_weight="balanced"
        ),
        "LightGBM": lgb.LGBMClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.05,
            class_weight="balanced",
            random_state=42,
            verbosity=-1,
        ),
    }

    print("\n--- Agent Underperformance Model Comparison (Validation Set) ---")
    val_metrics = {}
    for name, model in models.items():
        model.fit(X_train, y_train)
        probs = model.predict_proba(X_val)[:, 1]
        roc = float(roc_auc_score(y_val, probs))
        pr = float(average_precision_score(y_val, probs))
        preds = (probs >= 0.5).astype(int)
        p, r, f, _ = precision_recall_fscore_support(y_val, preds, average="binary", zero_division=0)
        val_metrics[name] = {
            "roc_auc": round(roc, 4),
            "pr_auc": round(pr, 4),
            "precision": round(float(p), 4),
            "recall": round(float(r), 4),
            "f1": round(float(f), 4),
        }
        print(f"[{name}] ROC-AUC: {roc:.4f} | PR-AUC: {pr:.4f} | F1: {f:.4f}")

    # Train Champion (Random Forest or LightGBM) on Train + Val, evaluate on Test
    champion = RandomForestClassifier(
        n_estimators=120, max_depth=6, random_state=42, class_weight="balanced"
    )
    X_tr_val = np.vstack([X_train, X_val])
    y_tr_val = np.concatenate([y_train, y_val])
    champion.fit(X_tr_val, y_tr_val)

    test_probs = champion.predict_proba(X_test)[:, 1]
    test_roc = float(roc_auc_score(y_test, test_probs))
    test_pr = float(average_precision_score(y_test, test_probs))

    # Operational threshold: 0.40
    opt_threshold = 0.40
    test_preds = (test_probs >= opt_threshold).astype(int)
    p, r, f, _ = precision_recall_fscore_support(y_test, test_preds, average="binary", zero_division=0)
    cm = confusion_matrix(y_test, test_preds).tolist()

    # Feature importance
    feat_imps = []
    for f_name, imp in zip(FEATURE_NAMES, champion.feature_importances_):
        feat_imps.append({"feature": f_name, "importance": round(float(imp), 4)})
    feat_imps.sort(key=lambda x: x["importance"], reverse=True)

    print("\n--- Final Test Performance on Out-Of-Time Test Set ---")
    print(f"ROC-AUC: {test_roc:.4f} | PR-AUC: {test_pr:.4f}")
    print(f"Precision: {p:.4f} | Recall: {r:.4f} | F1: {f:.4f}")
    print(f"Confusion Matrix: {cm}")

    # Save artifacts
    joblib.dump(champion, OUTPUT_DIR / "agent_underperformance_model.joblib")

    results = {
        "model_name": "Agent Underperformance / Service Gap Classifier",
        "algorithm": "Random Forest Classifier",
        "version": "1.0-forward-looking",
        "random_state": 42,
        "feature_list": FEATURE_NAMES,
        "target_definition": "Active days < 5 OR volume in bottom 20% in forward 30-day window",
        "model_comparison_validation": val_metrics,
        "test_performance": {
            "roc_auc": round(test_roc, 4),
            "pr_auc": round(test_pr, 4),
            "chosen_threshold": opt_threshold,
            "precision": round(float(p), 4),
            "recall": round(float(r), 4),
            "f1": round(float(f), 4),
            "confusion_matrix": cm,
            "class_distribution": {
                "total_test_rows": len(y_test),
                "underperforming_count": int(np.sum(y_test)),
                "normal_count": int(len(y_test) - np.sum(y_test)),
                "base_rate": round(float(np.mean(y_test)), 4),
            },
        },
        "top_features": feat_imps[:6],
    }

    with open(OUTPUT_DIR / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    # Score latest operations cutoff for agents
    score_probs = champion.predict_proba(X_score)[:, 1]
    score_preds = (score_probs >= opt_threshold).astype(int)

    score_records = []
    for aid, prob, pred in zip(score_ids, score_probs, score_preds):
        score_records.append({
            "agent_id": aid,
            "cutoff_date": "2026-08-31",
            "underperformance_risk_probability": round(float(prob), 4),
            "predicted_underperformance": int(pred),
            "risk_band": "HIGH" if prob >= 0.60 else ("MEDIUM" if prob >= opt_threshold else "LOW"),
            "model_version": "1.0-forward-looking",
        })

    out_csv = RUNTIME_OUTPUT_DIR / "agent_underperformance_predictions.csv"
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(score_records[0].keys()))
        writer.writeheader()
        writer.writerows(score_records)

    print(f"Scored {len(score_records)} agents saved to: {out_csv}")
    print(f"Underperformance flagged agents at threshold {opt_threshold}: {sum(score_preds)}/{len(score_preds)}")


if __name__ == "__main__":
    main()
