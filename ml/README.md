# MFS Intelligence Command Center — Phase 2 Machine Learning & Evaluation Suite

This directory contains the reproducible machine learning pipelines, evaluation protocols, and artifacts for the MFS Intelligence Command Center.

---

## 1. Governance & Dataset Principles

- **Dataset Nature:** 100% Synthetic data generated for the MFS Hackathon 2026. Contains no real customer PII, real bank balances, or live GPS telemetry.
- **Serving Mode:** Batch intelligence pipelines. All inference artifacts are timestamped and linked to specific operational horizons.
- **Honest Metric Policy:** Point forecast limitations (e.g. LightGBM liquidity $R^2 \approx -0.009$) are transparently disclosed. Systems are operationalized as calibrated buffers (P90) rather than claiming misleading point accuracy.

---

## 2. Model Policy & Architecture

| Capability | Engine Family | Phase 2 Status | Operational Horizon | Evaluation Metric Highlights |
|---|---|---|---|---|
| **Merchant Churn** | LightGBM Classifier | **NEW Forward-Looking** | Forward 30-Day Inactivity | ROC-AUC: `0.8402`, PR-AUC: `0.4266`, Recall: `88.71%` @ Threshold `0.35` |
| **Agent Underperformance** | Random Forest Classifier | **NEW Learned Model** | Forward 30-Day Service Gap | ROC-AUC: `0.9358`, PR-AUC: `0.7910`, Recall: `86.25%` @ Threshold `0.40` |
| **Merchant Category Demand** | XGBoost Regressor | Preserved + Baseline Eval | Next-Day Category Volume | Rolling 7d MAE: `21,707.56` vs Model, Calibrated P10-P90 Coverage: `80.26%` |
| **Agent Liquidity** | LightGBM Regressor | Preserved + P90 Buffer Eval | Next-Day Cashout Buffer | P90 Pinball Loss: `615.62`, Empirical Coverage: `89.93%` (Target: 90%), Shortfall: `10.07%` |
| **Merchant Benchmarking** | Percentile Engine | Cohort Percentiles (Rule) | 30-Day Cohort Snapshot | Category + Size cohort percentile rank; Fallback: category-only |
| **Merchant Growth** | Rule Engine | Deterministic Priority | 30-Day Activity Gap | Rules on benchmark gap, inactivity, and Bangla QR status |
| **Agent Performance** | Rule Engine | Operational Flags | 30-Day Rolling Window | Rules on active days (<5) and velocity ratio (<0.5) |
| **Location Intelligence** | Percentile Engine | Spatial Opportunity Rank | Geographic Index | Density rank of merchant volume + agent gap; no raw GPS |

---

## 3. Label & Feature Engineering (Zero Future Leakage)

### Merchant Forward Churn (`ml/churn/`)
- **Reference Date ($T$):** Strict cutoff date.
- **Features ($\le T$):** Only transactions occurring on or before $T$. Includes `days_since_last_txn` relative to $T$, transaction count (7d, 30d, 60d), transaction value (7d, 30d), active days, ticket size, velocity momentum ratios, tenure, and merchant categorical attributes.
- **Forward Label:** Binary `1` if merchant has **ZERO transactions in $(T, T + 30\text{d}]$**; else `0`.
- **Legacy Rule Comparison:** The legacy rule was deterministic (`days_since_last_txn >= 30` in observed data), creating circular 1.0 metrics. The Phase 2 model solves this with a strictly out-of-time forward hazard target.
- **Time-Aware Split:**
  - Train Cutoff: `2026-05-31` (forward June)
  - Validation Cutoff: `2026-06-30` (forward July)
  - Test Cutoff: `2026-07-31` (forward August)
  - Current Scoring: `2026-08-31` (5,000 canonical merchants scored)

### Agent Underperformance (`ml/agent_underperformance/`)
- **Reference Date ($T$):** Strict cutoff date.
- **Features ($\le T$):** Serviced volume, transaction count, active days, commission earned, success rate, and velocity ratio up to $T$.
- **Forward Label:** Binary `1` if agent records **$< 5$ active transaction days** OR transaction volume falls into the bottom 20th percentile in $(T, T + 30\text{d}]$; else `0`.

---

## 4. Commands to Reproduce

All commands use deterministic random seeds (`random_state=42`) and require no GPU or external cloud APIs.

```powershell
# 1. Run Forward Merchant Churn Pipeline (Data prep -> Model comparison -> Test evaluation)
.\.venv\Scripts\python.exe ml/churn/prepare_data.py
.\.venv\Scripts\python.exe ml/churn/train.py
.\.venv\Scripts\python.exe ml/churn/evaluate.py

# 2. Run Category Demand Baseline & Interval Evaluation
.\.venv\Scripts\python.exe ml/demand/evaluate_demand.py

# 3. Run Agent Liquidity P90 Buffer & Shortfall Evaluation
.\.venv\Scripts\python.exe ml/liquidity/evaluate_liquidity.py

# 4. Run Agent Underperformance Classifier Pipeline
.\.venv\Scripts\python.exe ml/agent_underperformance/train_underperformance.py

# 5. Run Grounded Copilot Evaluation (30 Cases)
.\.venv\Scripts\python.exe evaluation/evaluate_copilot.py
```

---

## 5. Artifact Outputs

- `ml/churn/`
  - `feature_manifest.json`: Feature definitions and split metadata.
  - `config.json`: Model hyperparameters, threshold policy, and boundaries.
  - `metrics.json`: Validation model comparison, test metrics, confusion matrix, threshold sweep, and top features.
  - `champion_lightgbm.joblib`: Serialized champion model weights.
- `ml/demand/`
  - `demand_evaluation.json`: MAE/RMSE comparisons against naive, 7d rolling, and seasonal-naive baselines, plus empirical residual interval coverage.
- `ml/liquidity/`
  - `liquidity_evaluation.json`: P90 pinball loss, empirical coverage (89.93%), shortfall proxy rates, and agent segment breakdowns.
- `ml/agent_underperformance/`
  - `metrics.json`: Classifier validation comparison, out-of-time test metrics, and top features.
  - `agent_underperformance_model.joblib`: Serialized Random Forest model weights.
- `evaluation/`
  - `copilot_cases.json`: 30 evaluation queries across 8 safety and intelligence categories.
  - `copilot_results.json`: Execution log with pass rates on grounding (100%), refusal (100%), numeric consistency, and entity integrity.
