# SRS vs Artifact Gap Analysis

Compares `docs/Track05_Merchant_Agent_Intelligence_SRS_Expanded.docx` with supplied extracted artifacts. Feature counts below are **verified from config JSON**.

- Agent Liquidity inference features: **18** (not 17)
- Merchant Demand inference features: **26**
- Agent Liquidity horizon: **`next_day`** / `2.0-cleaned-next-day`

**Build decisions:** batch-first; no retraining; pickle inference optional after version tests; honest labeling; all data synthetic; human review for consequential actions.

**Design (record only):** deep charcoal / near-black foundation, warm yellow/gold accents, cream text, restrained gold glow, separate semantic risk colors. Premium fintech cinematic UI. Future motion (nodes, pulse lines, transitions, KPI reveals, twin parallax, 2.5D opportunity) must support reduced motion, avoid heavy WebGL on every page, and never hide critical information behind animation.

---

## A. Fully supported now

Capabilities whose artifacts exist and can be described accurately without inventing models or metrics:

- Merchant **category** next-day **point** forecast, relative LOW/NORMAL/HIGH bands, rule-text actions (26 configured features)
- Merchant peer benchmarking (category + size, anonymized percentiles, reliability flags)
- Merchant growth recommendations (rule score, seven recommendation types, reasons)
- Agent **next-day** cash-out forecast + recommended-cash buffer + stress bands (18 configured features, cleaned next-day model)
- Agent performance percentiles, emerging/declining, service-gap and abnormal **peer-relative** flags (not fraud)
- Location expansion ranking with documented factor weights (120 locations)
- Synthetic-data documentation (`Dataset/README.json` and engine notes)
- Feature importance for demand and liquidity (model-card display)

---

## B. Supported using validated batch / precomputed intelligence

Do not require retraining. Serve CSVs (and later DB copies):

- Demand test-window series: 390 category-day rows (`2026-08-23`–`2026-09-30`)
- Churn scores: 1,000 rows after **merchant_id recovery** from `merchant_ml_features.csv` where the join is unique (771 unique fingerprint matches observed; 229 unmatched — handle as incomplete, do not invent IDs)
- Liquidity test-window series: 12,102 rows, 750 of 800 agents, 40 target dates
- Full 5,000-merchant benchmark and growth tables
- 800-agent performance table
- 120-location opportunity table
- Model/engine cards populated **only** with documented JSON/CSV metrics

---

## C. UI / workflow capabilities that can be implemented without retraining

SRS Must/Should product surfaces that can be built on batch data + new application tables:

- Auth / RBAC / demo personas (synthetic accounts)
- Command center KPIs, priority queue, insight feed
- Merchant 360: inherited **category** forecast, churn (with limitations), benchmark, growth, timeline
- Agent 360: **next-day** liquidity, performance, flagged review list
- Location ranking list + **schematic** district/cell visualization (not GPS-true)
- Intervention create/assign/acknowledge/complete + feedback capture
- Admin/model-card/audit screens using documented metrics and synthetic badge
- Filters, search, loading/empty/error/stale states
- Design system (charcoal + gold) and reduced-motion-safe motion later
- Scenario switcher as **seeded synthetic filters**, not a new model

These still must not display fabricated probabilities, hourly liquidity, or real coordinates.

---

## D. Unsupported capabilities that must NOT be fabricated

Do not invent metrics, horizons, geometries, or model families:

- Hourly or merchant-level demand; P50/P90 / interval coverage
- Liquidity 6 / 12 / 24 / 48-hour forecasts or live wallet/cash telemetry
- Isolation Forest or other trained anomaly detector; fraud detection
- Causal uplift, Precision@K experiments, contextual bandits
- Churn Medium/High bands (supplied file: Low/Critical only)
- Presenting churn 1.0 as production-grade skill without the inactivity-label limitation
- Real GPS / PostGIS truth from `locations.csv` (no lat/lon)
- Production upay data, real PII, real money movement, autonomous rebalancing
- LLM-originated risk scores, liquidity amounts, or permissions
- Drift / fairness **computed** panels (no cohort error files supplied)
- What-if simulators that pretend to re-run undocumented model physics
- Demand or liquidity “online inference” using target/future columns
- Claiming Agent Liquidity has 17 inference features (verified count is **18**)

---

## E. Future production capabilities

Credible later, not for the hackathon artifact set as supplied:

- Governed real-data evaluation, shadow mode, business experiments
- OIDC / MFA, secret manager, WAF
- Redis / Celery at scale, object storage model registry, signed artifacts
- True PostGIS geometries collected under a data contract
- Quantile / TFT / Prophet comparison models
- Champion-challenger, automated drift retraining gates
- Live agent float telemetry replacing `liquidity_limit` proxy

---

## Labeling contract for any later UI/API

| Topic | Required label |
|---|---|
| Demand | Category-level, next-day point forecast |
| Liquidity | Next-day only (`2.0-cleaned-next-day`) |
| Map | Synthetic / schematic; not real GPS |
| Churn metrics | 1.0 with deterministic 30-day inactivity-label limitation |
| Abnormal flags | Peer-relative operational review — not fraud |
| Data | Synthetic |
| Actions | Human review required |
| Serving | Batch-first; pickle optional after tests |
