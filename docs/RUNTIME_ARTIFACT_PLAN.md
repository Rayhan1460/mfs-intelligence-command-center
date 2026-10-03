# Runtime Artifact Plan

Batch-first serving is the initial safe implementation. Do not retrain models. Do not copy or mutate `/source_assets/` during runtime; later implementation should **read** from a controlled copy or seed path without renaming the source tree.

Verified: Agent Liquidity uses **18** inference features and horizon **`next_day`**. Merchant Demand uses **26** inference features. Neither inference list contains the numeric prediction target.

---

## 1. Runtime-required artifacts (application will need these)

These are required for a batch-first prototype (entity masters + configs for model cards + serving CSVs). Paths are under the extracted folder  
`source_assets/MFS_AI_Hackathon_2026-20261002T164011Z-1-001 (2)/MFS_AI_Hackathon_2026/`.

### Dataset masters

- `Dataset/README.json`
- `Dataset/locations.csv`
- `Dataset/agents.csv`
- `Dataset/merchants.csv`
- `Dataset/merchant_ml_features.csv` (features for churn **ID join**; strip label columns before any optional model call)
- `Dataset/location_daily_features.csv` (optional context; location scores already computed)

`transactions.csv` and `agent_liquidity_hourly.csv` are **large source tables**. They are not required on the hot API path if batch intelligence CSVs are served. Keep them available for lineage/demo documentation, not for per-request scans.

### Intelligence serving tables

- `Merchant_Demand_Forecasting/merchant_demand_intelligence_output.csv`
- `Merchant_Demand_Forecasting/merchant_demand_config.json`
- `Merchant_Demand_Forecasting/merchant_demand_performance.json`
- `Merchant_Demand_Forecasting/merchant_demand_feature_importance.csv`
- `Merchant_churn_predictions/Merchant_churn_predictions/merchant_churn_predictions.csv`
- `Merchant_churn_predictions/Merchant_churn_predictions/merchant_churn_model_metrics.csv`
- `Merchant_Growth_Recommendation/merchant_growth_intelligence_output.csv`
- `Merchant_Growth_Recommendation/merchant_growth_config.json`
- `Merchant_Growth_Recommendation/merchant_growth_validation.json`
- `Merchant_Growth_Recommendation/merchant_growth_recommendation_summary.csv`
- `Merchant_Growth_Recommendation/merchant_peer_benchmarks.csv`
- `Merchant_Benchmarking/merchant_benchmark_intelligence_output.csv`
- `Merchant_Benchmarking/merchant_benchmark_config.json`
- `Merchant_Benchmarking/merchant_benchmark_validation.json`
- `Merchant_Benchmarking/merchant_peer_group_summary.csv`
- `Merchant_Benchmarking/merchant_benchmark_band_validation.csv`
- `Agent_liquidity/agent_liquidity/agent_liquidity_intelligence_output.csv`
- `Agent_liquidity/agent_liquidity/agent_liquidity_config.json`
- `Agent_liquidity/agent_liquidity/agent_liquidity_performance.json`
- `Agent_liquidity/agent_liquidity/agent_liquidity_feature_importance.csv`
- `Agent_Performance_Intelligence/agent_performance_intelligence_output.csv`
- `Agent_Performance_Intelligence/agent_performance_config.json`
- `Agent_Performance_Intelligence/agent_performance_validation.json`
- `Agent_Performance_Intelligence/agent_performance_recommendation_summary.csv`
- `Agent_Performance_Intelligence/agent_performance_band_validation.csv`
- `Location_Intelligence/Location_Intelligence/location_intelligence_output.csv`
- `Location_Intelligence/Location_Intelligence/location_intelligence_config.json`
- `Location_Intelligence/Location_Intelligence/location_intelligence_validation.json`
- `Location_Intelligence/Location_Intelligence/location_recommendation_summary.csv`
- `Location_Intelligence/Location_Intelligence/location_priority_validation.csv`

---

## 2. Batch intelligence artifacts (source of truth for UI/API v1)

| Capability | Batch file | Grain |
|---|---|---|
| Demand | `merchant_demand_intelligence_output.csv` | category × `target_date` (390 rows) |
| Churn | `merchant_churn_predictions.csv` | 1,000 rows, **no merchant_id** (join to features) |
| Growth | `merchant_growth_intelligence_output.csv` | 5,000 merchants |
| Benchmark | `merchant_benchmark_intelligence_output.csv` | 5,000 merchants |
| Liquidity | `agent_liquidity_intelligence_output.csv` | agent × day, **test window**, 12,102 rows, 750 agents |
| Agent performance | `agent_performance_intelligence_output.csv` | 800 agents |
| Location | `location_intelligence_output.csv` | 120 locations |

Every API intelligence payload should include `source: synthetic`, `serving_mode: batch` (until pickle is validated), model/engine version, as-of timestamp, horizon, and documented limitations.

---

## 3. Training / archive-only files

Do **not** serve these as live predictions:

- `Agent_liquidity/agent_liquidity/agent_liquidity_trained_data.csv` — 79,691 modeling rows with `split` and `target_next_day_cashout`
- Feature-importance CSVs may be shown on model cards; they are not prediction stores
- Band/priority/recommendation **summary** CSVs are validation/dashboard helpers, not entity 360 sources of truth (use the full intelligence output)

Empty `outputs/` is not a serving root.

---

## 4. Target / leakage columns that must never be inference inputs

### Merchant demand

Do not add a future demand column to the 26-feature vector. Do not use `predicted_next_day_demand` as an input.

Allowed calendar fields already in the config: `target_day_of_week`, `target_month`, `target_is_weekend`.

### Agent liquidity

**Never send to the model:**

- `target_next_day_cashout`
- `cashout_demand_next_1h`
- `liquidity_pressure_next_1h`
- `predicted_next_day_cashout`
- `recommended_cash`
- `recommended_cash_covers_actual`
- `liquidity_stress_ratio` / `liquidity_stress_percent` / `risk_level` (derived outputs)

The 18-feature inference list does **not** include `target_next_day_cashout` (verified).

### Merchant churn

**Never send to the model:**

- `churn_30d`
- `churn_60d`
- `churn_90d`
- `actual_churn`
- `predicted_churn`
- `churn_probability`
- `risk_level`

### Growth

Config: churn labels are not used directly in the growth opportunity score. Do not inject them.

---

## 5. Files that must not be copied into the production image

- `source_assets/MFS_AI_Hackathon_2026-20261002T164011Z-1-001 (2).zip`
- Any future secrets, `.env` with credentials, or real PII (none should exist)
- Training-only `agent_liquidity_trained_data.csv` unless a clearly offline MLOps volume is required (default: **exclude** from the API image)
- The original SRS DOCX is documentation, not a runtime dependency

Prefer seeding a slim `data/` tree in a later implementation rather than shipping the entire OneDrive extract path.

---

## 6. Optional serialized-model inference (disabled until tests)

Enable only after pinning and smoke-testing versions. Do not install packages during this documentation phase.

| Artifact | Declared / observed stack | Feature contract |
|---|---|---|
| `merchant_demand_forecasting_model.pkl` | XGBoost `XGBRegressor` | **26** features, config order |
| `agent_liquidity_forecasting_model.pkl` | LightGBM `LGBMRegressor` | **18** features, config order, horizon `next_day` |
| `merchant_churn_model.pkl` | sklearn **1.6.1** Pipeline + `LGBMClassifier` | 17 numeric + 3 categorical names from pickle; no label columns |

Rules if/when enabled:

1. Validate pickle load against pinned `scikit-learn==1.6.1`, compatible `lightgbm`, `xgboost`, `numpy`, `joblib`.
2. Reject any feature vector with wrong length or order (liquidity length must be **18**, demand **26**).
3. Demand responses remain labeled **category-level next-day point forecast**.
4. Liquidity responses remain labeled **next-day only**.
5. Churn responses must include the **1.0 / inactivity-threshold limitation**.
6. If unpickle or schema checks fail, fall back to batch CSV last-known-good with a stale/degraded banner.
7. LLM (if added later) must not compute numbers.

Until those tests pass, **`serving_mode` stays `batch`.**
