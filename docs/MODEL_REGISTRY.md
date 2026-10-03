# Model & Intelligence Registry

Source of truth: extracted configs, validation/performance JSON, intelligence CSVs, and pickle metadata (opcode inspection only; models were not retrained or rewritten).

**Verified counts:** Agent Liquidity inference features = **18**. Merchant Demand inference features = **26**. Liquidity horizon = **`next_day`**.

Serving default: **batch-first**. Pickle inference is optional and only after dependency/version tests. All capabilities are **synthetic**. Consequential actions require **human review**.

---

## 1. Merchant Demand Forecasting

| Field | Value |
|---|---|
| Capability name | Merchant Demand Forecasting |
| ML vs engine | **ML** — XGBoost Regressor (`XGBRegressor`, `reg:squarederror`) |
| Runtime artifact | `Merchant_Demand_Forecasting/merchant_demand_forecasting_model.pkl` |
| Supporting artifacts | `merchant_demand_config.json`, `merchant_demand_performance.json`, `merchant_demand_intelligence_output.csv`, `merchant_demand_feature_importance.csv` |
| Serving mode | **Batch-first** (390 category-day test forecasts). Optional pickle later. |
| Horizon | **`next_day`**, grain **`merchant_category`** (not merchant, not hourly) |
| Synthetic-data status | Synthetic (`data_note` in performance JSON) |
| Recommended API | `GET /api/v1/demand/forecasts` and `GET /api/v1/merchants/{id}/forecast` (merchant screen **inherits category forecast**, labeled as such) |

### Exact inference feature list (config order, count = 26)

Counted with `len(json["features"])` from `merchant_demand_config.json`:

1. `daily_txn_count`
2. `daily_txn_value`
3. `unique_merchants`
4. `unique_customers`
5. `value_lag_1d`
6. `value_lag_2d`
7. `value_lag_7d`
8. `count_lag_1d`
9. `count_lag_7d`
10. `value_mean_3d`
11. `value_mean_7d`
12. `value_mean_14d`
13. `value_std_7d`
14. `target_day_of_week`
15. `target_month`
16. `target_is_weekend`
17. `category_Education`
18. `category_Electronics`
19. `category_Fashion`
20. `category_General Retail`
21. `category_Grocery`
22. `category_Healthcare`
23. `category_Pharmacy`
24. `category_Restaurant`
25. `category_Transport`
26. `category_Utility`

`target_day_of_week` / `target_month` / `target_is_weekend` are calendar attributes of the forecast date. **No future demand/target column is in this list.**

### Output schema (intelligence CSV)

`merchant_category`, `target_date`, `predicted_next_day_demand`, `recent_7d_avg_demand`, `forecast_change_percent`, `demand_level` (LOW / NORMAL / HIGH), `recommended_action`

Demand bands are validation 33rd/67th percentiles of **predictions** (`low_to_normal` 32132.8984375, `normal_to_high` 39925.4765625), not probabilities.

### Documented metrics

Test samples **390**, period `2026-08-23`–`2026-09-30`. XGBoost MAE **9834.678687099358**, RMSE **12827.8096717228**, R² **0.7723968453935751**, correlation **0.8811679369152751**. 7-day baseline MAE **10127.41297069597**. MAE improvement **2.8905139391831756%**. High-demand subset n=39, threshold **87313.04900000003**, XGB MAE **12720.97782852564**.

### Limitations

Label as **category-level, next-day point forecast**. No P50/P90. Recommendations are decision-support rules. Do not invent merchant-level or hourly series.

---

## 2. Merchant Churn Prediction

| Field | Value |
|---|---|
| Capability name | Merchant Churn Prediction |
| ML vs engine | **ML** — `sklearn.pipeline.Pipeline` (numeric `StandardScaler`, categorical `OneHotEncoder`, `LGBMClassifier`) |
| Runtime artifact | `Merchant_churn_predictions/Merchant_churn_predictions/merchant_churn_model.pkl` |
| Supporting artifacts | `merchant_churn_predictions.csv` (1,000 rows), `merchant_churn_model_metrics.csv` |
| Serving mode | **Batch-first** after attaching `merchant_id` from `merchant_ml_features.csv` where join is unique. Pickle optional and must carry the 1.0 limitation. |
| Horizon | Not in a config file. Feature table labels are `churn_30d` / `churn_60d` / `churn_90d`. Prediction file `actual_churn` matches **30-day inactivity** (`days_since_last_txn >= 30`). |
| Synthetic-data status | Synthetic |
| Recommended API | `GET /api/v1/merchants/{id}/churn-risk` |

### Exact input schema (pickle `feature_names_in_`, not a JSON config)

**Numeric (17):** `merchant_tenure_days`, `qr_enabled`, `app_enabled`, `days_since_last_txn`, `txn_count_7d`, `txn_value_7d`, `unique_customers_7d`, `active_days_7d`, `txn_count_30d`, `txn_value_30d`, `unique_customers_30d`, `active_days_30d`, `txn_count_90d`, `txn_value_90d`, `unique_customers_90d`, `active_days_90d`, `avg_txn_value_30d`

**Categorical (3):** `merchant_category`, `business_size`, `location_id`

**Never pass as inference inputs:** `churn_30d`, `churn_60d`, `churn_90d`, `actual_churn`.

### Output schema (predictions CSV)

Same feature columns as above, plus `actual_churn`, `predicted_churn`, `churn_probability`, `risk_level`. **No `merchant_id`.** `risk_level` values observed: **Low**, **Critical** only (857 / 143). Mismatch vs actual: **0**.

### Documented metrics

Accuracy, Precision, Recall, F1, ROC_AUC, PR_AUC — **all 1.0**.

### Limitations (mandatory UI/API copy)

These 1.0 figures must be shown with the **deterministic inactivity-label limitation**: in the supplied prediction file, churn-positive rows have `days_since_last_txn` from 30 to 999 and non-churn rows from 0 to 29. Do not claim generalizable production classifier skill. Do not fabricate Medium/High bands.

---

## 3. Merchant Growth Recommendation

| Field | Value |
|---|---|
| Capability name | Merchant Growth Recommendation |
| ML vs engine | **Rule / peer-benchmark decision-support engine** (not a trained model) |
| Runtime artifact | None (no pickle) |
| Supporting artifacts | `merchant_growth_config.json`, `merchant_growth_validation.json`, `merchant_growth_intelligence_output.csv` (5,000), `merchant_growth_recommendation_summary.csv`, `merchant_peer_benchmarks.csv` |
| Serving mode | **Batch** |
| Horizon | Snapshot / relative opportunity (no forecast horizon) |
| Synthetic-data status | Synthetic |
| Recommended API | `GET /api/v1/merchants/{id}/recommendations` |

### Input / score schema (from config)

Peer group: `merchant_category + business_size` (40 groups). Score 0–100 from `peer_performance_gap` (max 30), `recent_negative_trend` (max 25), `inactivity` (max 25), `digital_enablement_gap` (max 20). Config states **churn labels are not used directly in the growth opportunity score**.

### Output schema (intelligence CSV)

Includes `merchant_id`, `growth_opportunity_score`, `growth_priority`, `recommendation_type`, `recommended_action`, `recommendation_reason`, inactivity and peer-ratio fields, digital flags, `growth_history_available`.

Recommendation types: `CUSTOMER_GROWTH`, `DECLINING_ACTIVITY`, `DIGITAL_ENABLEMENT`, `DIGITAL_OPTIMIZATION`, `MAINTAIN_AND_MONITOR`, `RETENTION_REACTIVATION`, `TRANSACTION_VALUE_GROWTH`.

### Documented metrics

5,000 merchants; history available 4,848; insufficient history 152. Priority: LOW 2498, MEDIUM 1252, HIGH 684, CRITICAL 566. Score calculation mismatches 0.

### Limitations

Growth opportunity score is **not a probability**. Not causal uplift. Decision support; human review required.

---

## 4. Merchant Benchmarking

| Field | Value |
|---|---|
| Capability name | Merchant Benchmarking |
| ML vs engine | **Explainable peer-relative percentile engine** (not ML) |
| Runtime artifact | None (no pickle) |
| Supporting artifacts | `merchant_benchmark_config.json`, `merchant_benchmark_validation.json`, `merchant_benchmark_intelligence_output.csv` (5,000), `merchant_peer_group_summary.csv`, `merchant_benchmark_band_validation.csv` |
| Serving mode | **Batch** |
| Horizon | Snapshot (30-day features in output) |
| Synthetic-data status | Synthetic |
| Recommended API | `GET /api/v1/merchants/{id}/benchmark` |

### Input / engine schema

Peer group: `merchant_category + business_size`. Equal weights 0.2 on Transaction Frequency, Transaction Value, Customer Reach, Active Days, Average Transaction Value. Reliability: HIGH ≥50 peers, MODERATE 20–49, LIMITED <20.

### Output schema

Percentiles, `benchmark_score` (0–100), `benchmark_band` (NEEDS_ATTENTION / DEVELOPING / STRONG / LEADING), strongest/weakest dimension, insight, plus joined growth fields.

### Documented metrics

Mean score 50.4; bands 1051 / 1338 / 1520 / 1091; reliability HIGH 4792, MODERATE 105, LIMITED 103; missing scores 0.

### Limitations

Not a probability or model accuracy. Not causal. Limited-reliability groups. Human review of recommendations.

---

## 5. Agent Liquidity Intelligence

| Field | Value |
|---|---|
| Capability name | Agent Liquidity Intelligence |
| ML vs engine | **ML** — LightGBM Regressor + validation-calibrated buffer and stress bands (bands are **not** shortage probabilities) |
| Runtime artifact | `Agent_liquidity/agent_liquidity/agent_liquidity_forecasting_model.pkl` |
| Supporting artifacts | `agent_liquidity_config.json`, `agent_liquidity_performance.json`, `agent_liquidity_intelligence_output.csv` (12,102 test rows), `agent_liquidity_feature_importance.csv` |
| Archive only | `agent_liquidity_trained_data.csv` (79,691 rows; includes `split` and target) |
| Serving mode | **Batch-first** (test-window forecasts). Optional pickle later with **exact 18-feature order**. |
| Horizon | **`next_day`** (`version: 2.0-cleaned-next-day`). Label **next-day only**. |
| Target (not an input) | `target_next_day_cashout` |
| Synthetic-data status | Synthetic; no real customer PII |
| Recommended API | `GET /api/v1/agents/{id}/liquidity-forecast` with `horizon=next_day` only |

### Exact inference feature list (config order, count = 18)

Counted with `len(json["features"])` from `agent_liquidity_config.json`. **Corrected from the earlier mistaken count of 17.**

1. `txn_count`
2. `txn_value`
3. `unique_customers`
4. `cash_in_count`
5. `cash_in_value`
6. `cash_out_count`
7. `cash_out_value`
8. `net_cash_flow`
9. `liquidity_limit`
10. `cashout_lag_1d`
11. `cashout_lag_2d`
12. `cashout_lag_7d`
13. `cashout_mean_3d`
14. `cashout_mean_7d`
15. `cashout_std_7d`
16. `target_day_of_week`
17. `target_month`
18. `target_is_weekend`

Verified: `target_next_day_cashout` **is not** in this list. Items 16–18 are horizon-date calendar features, not the cash-out target. Also **not** in this list: `cashout_demand_next_1h`, `liquidity_pressure_next_1h`.

### Output schema (intelligence CSV)

`agent_id`, `location_id`, `date`, `target_date`, `liquidity_limit`, `cash_out_value`, lags/rolling columns, `target_next_day_cashout` (**validation column; do not send to the model**), `predicted_next_day_cashout`, `recommended_cash`, `liquidity_stress_ratio`, `liquidity_stress_percent`, `risk_level`, `recommended_action`, `recommended_cash_covers_actual`

Coverage in this file: True 10883 / False 1219 (**89.93%**), matching documented `test_coverage_percent`. Unique agents in output: **750 / 800**.

### Documented metrics

Dataset after next-day gap filter: 79,691. Train 55,348 (`2026-01-09`–`2026-07-12` targets), validation 12,241, test 12,102 (`2026-08-22`–`2026-09-30` targets). Test MAE **1455.4535692640663**, RMSE **2747.8600943393994**, R² **−0.00949021684101603**. 7-day baseline MAE **1465.1467989942628**. MAE improvement **0.6615876127122735%**. Recommended-cash coverage **89.92728474632293%** (predicted + validation 90th-percentile buffer covering actual; **not accuracy**). Shortage buffer 90th percentile **1999.5278320059485**. Risk definition: `recommended_cash / liquidity_limit`.

### Limitations

`liquidity_limit` is not confirmed real-time cash. Weak R². Human/operator review before consequential financial action. Do not expose 6/12/24/48-hour paths from this model.

---

## 6. Agent Performance Intelligence

| Field | Value |
|---|---|
| Capability name | Agent Performance Intelligence |
| ML vs engine | **Rule / percentile engine** — **not** Isolation Forest, **not** a trained ML model |
| Runtime artifact | None (no pickle) |
| Supporting artifacts | `agent_performance_config.json`, `agent_performance_validation.json`, `agent_performance_intelligence_output.csv` (800), `agent_performance_recommendation_summary.csv`, `agent_performance_band_validation.csv` |
| Serving mode | **Batch** |
| Horizon | Recent-30-day snapshot |
| Synthetic-data status | Synthetic |
| Recommended API | `GET /api/v1/agents/{id}/performance` and optional `GET /api/v1/agents/{id}/anomalies` as **filtered flags from the same CSV** |

### Engine schema

Peer group: `agent_type`. Equal-weight mean of within-type percentile ranks on Transaction Activity, Transaction Value, Customer Reach, Operating Activity, Service Reliability. Momentum: peer percentile of recent-vs-previous 30-day growth. Service gap: peer-relative failure/reversal index (q90 threshold documented). Abnormal pattern: extreme same-type peer activity percentiles.

### Output schema

Performance score/band, momentum, growth rates, `emerging_high_performer`, `declining_agent`, `service_gap_score` / `service_gap_flag`, `abnormal_high_activity` / `abnormal_low_activity` / `abnormal_pattern_flag`, primary strength/improvement, recommended action/reason.

### Documented metrics

800 unique agents; missing scores 0. Emerging 96, declining 193, service-gap 80, abnormal-pattern 15.

### Limitations

Relative index, not a probability. **Abnormal-pattern flags do not imply fraud** and must not be described as fraud detection. Human review required.

---

## 7. Location Intelligence

| Field | Value |
|---|---|
| Capability name | Location Intelligence |
| ML vs engine | **Percentile decision-support engine** (not ML) |
| Runtime artifact | None (no pickle) |
| Supporting artifacts | `location_intelligence_config.json`, `location_intelligence_validation.json`, `location_intelligence_output.csv` (120), `location_recommendation_summary.csv`, `location_priority_validation.csv` |
| Serving mode | **Batch** |
| Horizon | Aggregated observed window (`observed_days` in output) |
| Synthetic-data status | Synthetic; no real customer PII |
| Recommended API | `GET /api/v1/locations/opportunities` |

### Engine schema

Merchant expansion weights: demand_opportunity 0.5, merchant_coverage_pressure 0.4, structural_opportunity 0.1. Agent expansion weights: demand_opportunity 0.5, agent_coverage_pressure 0.4, structural_opportunity 0.1.

### Output schema

Demand/coverage/structural scores, `merchant_expansion_score`, `agent_expansion_score`, `location_opportunity_score`, `expansion_priority`, `recommended_expansion`, reason, action.

### Documented metrics

120 locations; missing opportunity scores 0. Priority: LOW 60, MEDIUM 30, HIGH 18, CRITICAL 12. Recommendations: MONITOR_CURRENT_COVERAGE 79, MERCHANT_AND_AGENT_EXPANSION 19, AGENT_EXPANSION 11, MERCHANT_EXPANSION 11.

### Limitations

Relative prioritization, not probabilities. CRITICAL is top-decile relative opportunity, **not** an emergency. **`locations.csv` has no lat/lon.** Maps must not pretend to have real GPS coordinates. Expansion requires human review.
