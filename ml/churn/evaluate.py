"""
ml/churn/evaluate.py
Loads trained champion model and performs comprehensive evaluation
across threshold sweeps, class balance, and confusion matrix metrics.
"""

import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import joblib
import numpy as np
from sklearn.metrics import roc_auc_score, average_precision_score, precision_recall_fscore_support, confusion_matrix
from ml.churn.train import load_dataset, CHURN_DIR, FEATURE_COLS

def main():
    print("Evaluating champion model on test set...")
    model_path = CHURN_DIR / "champion_lightgbm.joblib"
    if not model_path.exists():
        raise FileNotFoundError(f"Champion model not found at {model_path}. Run train.py first.")

    model = joblib.load(model_path)
    test_ids, X_test, y_test = load_dataset(CHURN_DIR / "test.csv")
    assert y_test is not None

    test_probs = model.predict_proba(X_test)[:, 1]
    roc_auc = float(roc_auc_score(y_test, test_probs))
    pr_auc = float(average_precision_score(y_test, test_probs))

    thresholds = [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60]
    print(f"\n--- Evaluation Summary (Test Set N={len(y_test)}) ---")
    print(f"ROC-AUC: {roc_auc:.4f} | PR-AUC: {pr_auc:.4f} | Base Rate: {np.mean(y_test):.2%}\n")
    print(f"{'Threshold':<10} {'Precision':<10} {'Recall':<10} {'F1':<10} {'Flagged':<12}")
    print("-" * 55)

    for t in thresholds:
        y_pred = (test_probs >= t).astype(int)
        prec, rec, f1, _ = precision_recall_fscore_support(y_test, y_pred, average="binary", zero_division=0)
        flagged = int(np.sum(y_pred))
        print(f"{t:<10.2f} {prec:<10.4f} {rec:<10.4f} {f1:<10.4f} {flagged} ({flagged/len(y_test):.1%})")

if __name__ == "__main__":
    main()
