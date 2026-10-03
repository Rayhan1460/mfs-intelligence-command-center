# Implementation Audit

Track 05 — MFS Merchant & Agent Intelligence Command Center  
Document status: verified post-audit (feature counts counted from config JSON)  
Original SRS file (unchanged): `docs/Track05_Merchant_Agent_Intelligence_SRS_Expanded.docx`

**This document is read-only guidance for a later build. It is not an implementation.**

---

## 1. Executive summary

The supplied package is a **synthetic Track 05 intelligence pack**, not a running product. There is no FastAPI or Next.js application yet. What exists is:

- one complete SRS DOCX
- a synthetic dataset (seed 42)
- **three serialized ML pickles** (demand XGBoost, churn sklearn+LightGBM pipeline, liquidity LightGBM)
- **four rule / percentile engines** with validated CSV outputs (growth, benchmarking, agent performance, location)

**Verified Agent Liquidity model (final):** `version: 2.0-cleaned-next-day`, `forecast_horizon: next_day`, target `target_next_day_cashout`.

**Verified inference feature counts (from config JSON, programmatic `len(features)`):**

| Config | Count | Horizon |
|---|---:|---|
| Agent Liquidity `features` | **18** | `next_day` |
| Merchant Demand `features` | **26** | `next_day` at `merchant_category` |

The previous narrative audit incorrectly said Agent Liquidity had **17** features while listing all **18** names. The correct count is **18**. Calendar fields `target_day_of_week`, `target_month`, and `target_is_weekend` are **horizon-date attributes known at forecast time**. They are **not** the prediction target. The actual target column `target_next_day_cashout` is **not** in the liquidity inference list. Demand likewise does not include a future demand/target column in its inference list.

### Build decisions (approved)

- **Batch-first serving** is the initial safe implementation.
- **Do not retrain** existing models.
- Direct pickle inference is **optional** and only after dependency/version validation.
- Merchant Demand must be labeled **category-level, next-day point forecast**.
- Agent Liquidity must be labeled **next-day only**.
- Location map must **not pretend to have real GPS coordinates**.
- Churn **1.0** metrics must include the **deterministic inactivity-label limitation**.
- Agent abnormal flags must **not** be described as fraud detection.
- **All data is synthetic.**
- **Human review** remains required for consequential actions.

### Design direction (record only; do not implement yet)

- Foundation: deep charcoal / near-black / dark navy
- Accent: premium warm yellow / gold, restrained (not a bright-yellow site)
- Text / surfaces: soft cream / off-white
- Glow: restrained gold
- Semantic red / amber / green reserved for risk/status
- Feel: premium, modern, fintech, cinematic, professional — not childish or game-like
- Future motion: ecosystem nodes, transaction pulse lines, page transitions, KPI/chart reveals, subtle digital-twin parallax, 2.5D opportunity visualization
- Motion rules: no heavy WebGL on every page; `prefers-reduced-motion` required; critical information never depends on animation

---

## 2. Supplied project inventory

| Path | Role |
|---|---|
| `docs/Track05_Merchant_Agent_Intelligence_SRS_Expanded.docx` | Product SRS (do not modify) |
| `source_assets/MFS_AI_Hackathon_2026-20261002T164011Z-1-001 (2)/MFS_AI_Hackathon_2026/` | Extracted source of truth |
| Same-named `.zip` under `source_assets/` | Archive duplicate; do not use as analysis or runtime source |
| `.../MFS_AI_Hackathon_2026/outputs/` | Empty |
| Repo `frontend/` / `backend/` | Not present |

Extracted module folders:

1. `Merchant_Demand_Forecasting/`
2. `Merchant_churn_predictions/Merchant_churn_predictions/`
3. `Merchant_Growth_Recommendation/`
4. `Merchant_Benchmarking/`
5. `Agent_liquidity/agent_liquidity/`
6. `Agent_Performance_Intelligence/`
7. `Location_Intelligence/Location_Intelligence/`
8. `Dataset/`

Serialized models (3):

- `merchant_demand_forecasting_model.pkl` — `xgboost.sklearn.XGBRegressor`
- `merchant_churn_model.pkl` — `sklearn.pipeline.Pipeline` (StandardScaler + OneHotEncoder + `LGBMClassifier`), pickle `_sklearn_version` **1.6.1**
- `agent_liquidity_forecasting_model.pkl` — `lightgbm.sklearn.LGBMRegressor`

No Isolation Forest, Prophet/TFT, quantile regressor, or SHAP value files are supplied.

**Do not modify, move, rename, delete, or retrain anything inside `/source_assets/`.**

---

## 3. Dataset inventory

Canonical files live in `Dataset/`. `README.json` documents seed **42** and synthetic/no-PII policy. Observed row counts match the README (excluding headers):

| File | Rows | Notes |
|---|---:|---|
| `locations.csv` | 120 | District / area_type / density indices. **No lat/lon.** |
| `agents.csv` | 800 | 780 Active / 20 Inactive |
| `merchants.csv` | 5,000 | All `Active` |
| `transactions.csv` | 250,000 | `2026-01-01`–`2026-09-30`; `customer_hash_id` |
| `merchant_ml_features.csv` | 5,000 | Includes `churn_30d` / `churn_60d` / `churn_90d` **labels** |
| `agent_liquidity_hourly.csv` | 227,863 | Includes **next-1h target** columns |
| `location_daily_features.csv` | 32,697 | Daily location aggregates |

Treat **all** records as **synthetic**. Never present them as production upay customers.

Near-duplicates (not byte-identical): growth `merchant_peer_benchmarks.csv` vs benchmarking `merchant_peer_group_summary.csv`. Hourly liquidity source vs cleaned daily trained table are different grain.

---

## 4. Current implementation readiness

| Area | Status |
|---|---|
| SRS | Present (DOCX) |
| Synthetic data | Present and documented |
| Seven Track 05 capabilities | Artifacts present (3 ML + 4 engines) |
| Batch intelligence CSVs | Present and validated in module JSON/CSV |
| FastAPI / Pydantic API | **Not started** |
| Next.js UI | **Not started** |
| PostgreSQL / PostGIS / Alembic | **Not started** |
| Auth / RBAC / interventions | **Not started** |
| Pinned ML runtime (`requirements.txt`) | **Not present** |
| Direct pickle inference | **Not enabled**; optional later after version tests |
| Safe first product | **Batch serving of validated CSVs + entity masters** |

Recommended first serving posture: ingest validated intelligence CSVs into the application database and expose versioned `/api/v1` reads. Do not block the prototype on unpickling XGBoost/LightGBM/sklearn.

---

## 5. Important limitations

1. **All data and scores are synthetic.**
2. **Merchant Demand** is a **category-level next-day point forecast**, not merchant-level, not hourly, and not P50/P90.
3. **Agent Liquidity** is **next calendar day** only (`2.0-cleaned-next-day`). It is not 6/12/24/48-hour and not live cash-on-hand. `liquidity_limit` is a capacity proxy. Test R² is weakly negative; recommended-cash coverage is **not** model accuracy.
4. **Churn** documented metrics are all **1.0**. In the 1,000-row prediction file, `actual_churn = 1` iff `days_since_last_txn >= 30`. That is a **deterministic inactivity label**, not evidence of generalizable ML skill. The prediction CSV has **no `merchant_id`**. Risk bands in that file are only **Low / Critical**.
5. **Growth and benchmarking scores are not probabilities** and are not causal.
6. **Agent performance / abnormal flags are peer-relative review signals, not fraud detection.** There is no Isolation Forest artifact.
7. **Location opportunity scores are relative indices.** CRITICAL does not mean an emergency. **No GPS coordinates** exist in `locations.csv`.
8. Consequential operational or financial actions **must remain human-reviewed**.
9. Do not use target / future columns as inference inputs (see `RUNTIME_ARTIFACT_PLAN.md`).
10. Calendar features named `target_*` on demand and liquidity are **horizon-date fields**, not the numeric target.

---

## 6. Blocking issues (before application implementation)

1. No application codebase yet — expected until implementation is explicitly approved.
2. Churn predictions lack `merchant_id`; 1.0 metrics must be explained, not celebrated.
3. Demand artifacts do not satisfy SRS hourly/merchant/uncertainty wording; UI/API labels must stay honest.
4. Liquidity artifacts do not satisfy SRS 6/12/24/48-hour wording; API must expose `horizon=next_day` only.
5. No Isolation Forest; do not fabricate anomaly-model metrics.
6. No lat/lon; maps must be schematic / synthetic layout.
7. Fifty agents have no liquidity **test-window** output; twenty agents are Inactive.
8. Pickle runtime is unproven here (no ML packages installed by design of this phase).
9. `agent_liquidity_trained_data.csv` and hourly next-1h targets must not be served as live predictions.
10. Keep the original ZIP out of any future production image.

**Stop: wait for approval before building frontend or backend.**
