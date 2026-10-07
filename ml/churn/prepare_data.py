"""
ml/churn/prepare_data.py
Prepares temporal forward-looking merchant churn dataset with zero future leakage.

Reference Dates (T):
- Train Cutoff: 2026-05-31 (Forward 30d window: June 1 - June 30, 2026)
- Validation Cutoff: 2026-06-30 (Forward 30d window: July 1 - July 30, 2026)
- Test Cutoff: 2026-07-31 (Forward 30d window: August 1 - August 30, 2026)
- Scoring Cutoff: 2026-08-31 (Current operational scoring horizon)

Features at Cutoff T:
- Strictly information available on or before T (days_since_last_txn relative to T,
  txn_count_7d, txn_count_30d, txn_count_60d, txn_value_7d, txn_value_30d,
  active_days_30d, avg_txn_value_30d, velocity ratios, tenure_days, qr_enabled, app_enabled,
  merchant_category, business_size).
Target Label:
- 1 if merchant has ZERO transactions in (T, T + 30 days] (forward 30-day inactivity).
- 0 if merchant has at least 1 transaction in that period.
"""

import csv
import json
from datetime import datetime, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]

# Try source assets first, then fallback to backend runtime assets if needed
CANDIDATE_TXN_PATHS = [
    BASE_DIR / "source_assets" / "MFS_AI_Hackathon_2026-20261002T164011Z-1-001 (2)" / "MFS_AI_Hackathon_2026" / "Dataset" / "transactions.csv",
    BASE_DIR / "backend" / "runtime_assets" / "Dataset" / "transactions.csv",
]
MERCHANTS_PATH = BASE_DIR / "backend" / "runtime_assets" / "Dataset" / "merchants.csv"
OUTPUT_DIR = BASE_DIR / "ml" / "churn"

FEATURE_NAMES = [
    "merchant_category_encoded",
    "business_size_encoded",
    "qr_enabled",
    "app_enabled",
    "merchant_tenure_days",
    "days_since_last_txn",
    "txn_count_7d",
    "txn_count_30d",
    "txn_count_60d",
    "txn_value_7d",
    "txn_value_30d",
    "avg_txn_value_30d",
    "active_days_30d",
    "txn_velocity_ratio",
    "value_velocity_ratio",
]

CATEGORY_MAP = {
    "Grocery": 0,
    "Clothing": 1,
    "Restaurant": 2,
    "Electronics": 3,
    "Pharmacy": 4,
    "General": 5,
}

SIZE_MAP = {
    "Micro": 0,
    "Small": 1,
    "Medium": 2,
    "Large": 3,
}


def parse_date(d_str: str) -> datetime:
    return datetime.strptime(d_str.strip()[:10], "%Y-%m-%d")


def load_merchants() -> dict[str, dict]:
    merchants = {}
    with open(MERCHANTS_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            merchants[row["merchant_id"]] = {
                "merchant_id": row["merchant_id"],
                "merchant_category": row.get("merchant_category", "General"),
                "business_size": row.get("business_size", "Small"),
                "qr_enabled": 1 if str(row.get("qr_enabled", "0")).lower() in ("1", "true") else 0,
                "app_enabled": 1 if str(row.get("app_enabled", "0")).lower() in ("1", "true") else 0,
                "onboarding_date": parse_date(row["onboarding_date"]) if row.get("onboarding_date") else None,
                "merchant_status": row.get("merchant_status", "Active"),
            }
    return merchants


def load_transactions() -> list[dict]:
    txn_path = None
    for p in CANDIDATE_TXN_PATHS:
        if p.exists():
            txn_path = p
            break
    if not txn_path:
        raise FileNotFoundError(f"transactions.csv not found in candidate paths: {CANDIDATE_TXN_PATHS}")

    print(f"Loading transactions from: {txn_path}")
    transactions = []
    with open(txn_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row.get("merchant_id"):
                continue
            t_date = parse_date(row["transaction_date"])
            amt = float(row.get("transaction_amount") or 0.0)
            status = row.get("transaction_status", "SUCCESS").upper()
            transactions.append({
                "merchant_id": row["merchant_id"],
                "date": t_date,
                "amount": amt,
                "status": status,
            })
    print(f"Loaded {len(transactions)} transactions.")
    return transactions


def build_dataset_at_cutoff(
    cutoff: datetime,
    forward_days: int,
    merchants: dict[str, dict],
    transactions: list[dict],
    is_scoring_split: bool = False,
) -> tuple[list[dict], dict]:
    """
    Computes strictly past features relative to cutoff T.
    Target evaluates whether merchant has 0 transactions in (T, T + forward_days].
    """
    cutoff_str = cutoff.strftime("%Y-%m-%d")
    window_7d = cutoff - timedelta(days=7)
    window_30d = cutoff - timedelta(days=30)
    window_60d = cutoff - timedelta(days=60)
    forward_end = cutoff + timedelta(days=forward_days)

    # Index transactions before and after cutoff per merchant
    past_txns_by_m = {m_id: [] for m_id in merchants}
    forward_txns_by_m = {m_id: [] for m_id in merchants}

    for txn in transactions:
        m_id = txn["merchant_id"]
        if m_id not in merchants:
            continue
        t_date = txn["date"]
        if t_date <= cutoff:
            past_txns_by_m[m_id].append(txn)
        elif t_date <= forward_end:
            forward_txns_by_m[m_id].append(txn)

    rows = []
    eligible_count = 0
    ineligible_reasons = {"onboarded_after_cutoff": 0}

    for m_id, m in merchants.items():
        # Eligibility: Onboarded on or before cutoff
        if m["onboarding_date"] and m["onboarding_date"] > cutoff:
            ineligible_reasons["onboarded_after_cutoff"] += 1
            continue

        eligible_count += 1
        tenure_days = (cutoff - m["onboarding_date"]).days if m["onboarding_date"] else 180

        # Past features strictly <= cutoff
        past_txns = past_txns_by_m[m_id]
        if past_txns:
            latest_date = max(t["date"] for t in past_txns)
            days_since_last_txn = max(0, (cutoff - latest_date).days)
        else:
            days_since_last_txn = min(180, tenure_days)

        txns_7d = [t for t in past_txns if t["date"] > window_7d]
        txns_30d = [t for t in past_txns if t["date"] > window_30d]
        txns_60d = [t for t in past_txns if t["date"] > window_60d]

        txn_count_7d = len(txns_7d)
        txn_count_30d = len(txns_30d)
        txn_count_60d = len(txns_60d)

        txn_value_7d = sum(t["amount"] for t in txns_7d)
        txn_value_30d = sum(t["amount"] for t in txns_30d)

        avg_txn_value_30d = txn_value_30d / txn_count_30d if txn_count_30d > 0 else 0.0
        active_days_30d = len(set(t["date"] for t in txns_30d))

        # Velocity ratios (momentum drop detection)
        weekly_expected_30d = (txn_count_30d / 4.0) + 1e-4
        txn_velocity_ratio = txn_count_7d / weekly_expected_30d

        weekly_val_expected_30d = (txn_value_30d / 4.0) + 1e-4
        value_velocity_ratio = txn_value_7d / weekly_val_expected_30d

        # Forward Target (None if scoring split where forward window has not completed)
        if not is_scoring_split:
            forward_count = len(forward_txns_by_m[m_id])
            target_churn = 1 if forward_count == 0 else 0
        else:
            target_churn = None

        row = {
            "merchant_id": m_id,
            "cutoff_date": cutoff_str,
            "merchant_category_encoded": CATEGORY_MAP.get(m["merchant_category"], 5),
            "business_size_encoded": SIZE_MAP.get(m["business_size"], 1),
            "qr_enabled": m["qr_enabled"],
            "app_enabled": m["app_enabled"],
            "merchant_tenure_days": tenure_days,
            "days_since_last_txn": days_since_last_txn,
            "txn_count_7d": txn_count_7d,
            "txn_count_30d": txn_count_30d,
            "txn_count_60d": txn_count_60d,
            "txn_value_7d": round(txn_value_7d, 2),
            "txn_value_30d": round(txn_value_30d, 2),
            "avg_txn_value_30d": round(avg_txn_value_30d, 2),
            "active_days_30d": active_days_30d,
            "txn_velocity_ratio": round(txn_velocity_ratio, 4),
            "value_velocity_ratio": round(value_velocity_ratio, 4),
            "target_churn_30d_forward": target_churn,
        }
        rows.append(row)

    meta = {
        "cutoff_date": cutoff_str,
        "eligible_merchants": eligible_count,
        "total_merchants": len(merchants),
        "ineligible_breakdown": ineligible_reasons,
        "positive_churn_count": sum(1 for r in rows if r["target_churn_30d_forward"] == 1) if not is_scoring_split else None,
        "negative_churn_count": sum(1 for r in rows if r["target_churn_30d_forward"] == 0) if not is_scoring_split else None,
    }
    return rows, meta


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    merchants = load_merchants()
    transactions = load_transactions()

    t_train = datetime(2026, 5, 31)
    t_val = datetime(2026, 6, 30)
    t_test = datetime(2026, 7, 31)
    t_score = datetime(2026, 8, 31)

    print("Generating train split (cutoff 2026-05-31, forward window June)...")
    train_rows, train_meta = build_dataset_at_cutoff(t_train, 30, merchants, transactions)

    print("Generating validation split (cutoff 2026-06-30, forward window July)...")
    val_rows, val_meta = build_dataset_at_cutoff(t_val, 30, merchants, transactions)

    print("Generating test split (cutoff 2026-07-31, forward window August)...")
    test_rows, test_meta = build_dataset_at_cutoff(t_test, 30, merchants, transactions)

    print("Generating scoring split (cutoff 2026-08-31 for current operations)...")
    score_rows, score_meta = build_dataset_at_cutoff(t_score, 30, merchants, transactions, is_scoring_split=False)

    # Save to CSV
    def save_csv(path: Path, data: list[dict]):
        if not data:
            return
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(data[0].keys()))
            writer.writeheader()
            writer.writerows(data)

    save_csv(OUTPUT_DIR / "train.csv", train_rows)
    save_csv(OUTPUT_DIR / "val.csv", val_rows)
    save_csv(OUTPUT_DIR / "test.csv", test_rows)
    save_csv(OUTPUT_DIR / "score.csv", score_rows)

    manifest = {
        "dataset_name": "MFS Merchant Forward-Looking 30-Day Churn",
        "reference_period_train": "2026-05-31",
        "reference_period_val": "2026-06-30",
        "reference_period_test": "2026-07-31",
        "reference_period_score": "2026-08-31",
        "feature_list": FEATURE_NAMES,
        "feature_count": len(FEATURE_NAMES),
        "target_definition": "1 if zero transactions in (T, T + 30 days], else 0 (No future leakage)",
        "canonical_merchants_count": len(merchants),
        "split_summary": {
            "train": train_meta,
            "val": val_meta,
            "test": test_meta,
            "score": score_meta,
        },
    }

    with open(OUTPUT_DIR / "feature_manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"Data preparation complete. Artifacts saved to: {OUTPUT_DIR}")
    print(f"Train rows: {len(train_rows)} (Churn rate: {train_meta['positive_churn_count']}/{len(train_rows)})")
    print(f"Val rows: {len(val_rows)} (Churn rate: {val_meta['positive_churn_count']}/{len(val_rows)})")
    print(f"Test rows: {len(test_rows)} (Churn rate: {test_meta['positive_churn_count']}/{len(test_rows)})")


if __name__ == "__main__":
    main()
