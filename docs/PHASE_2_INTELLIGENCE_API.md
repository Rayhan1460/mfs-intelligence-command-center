# Phase 2 Intelligence API

The read-only intelligence APIs use only the validated synthetic batch CSV/JSON files under the extracted Track 05 source package. Artifacts are loaded lazily and cached in process memory. The repository does not load transaction histories, hourly liquidity inputs, trained-data archives, or serialized model files.

Set `SOURCE_ASSETS_ROOT` to the extracted `MFS_AI_Hackathon_2026` directory to override the repository-relative development default. Missing artifacts return a safe `intelligence_not_available` response without exposing local paths.

## Churn Merchant-ID Reconstruction

The churn prediction CSV has no `merchant_id`. Its rows are joined to `Dataset/merchant_ml_features.csv` by exact equality across the 20 non-label model feature fields: the three categorical features and 17 numeric features documented in `MODEL_REGISTRY.md`. Labels (`churn_30d`, `churn_60d`, `churn_90d`, `actual_churn`) are not used in the join. A key is accepted only when unique in both source tables. The verified source package yields 771 unique matches; unmatched or duplicate keys remain unavailable rather than receiving guessed IDs.

The API does not return `actual_churn` or any churn-label column. Churn is framed as 30-day inactivity risk and carries the deterministic-label limitation. A supplied probability is returned only for uniquely matched batch records.

## Endpoint Inventory

- `GET /api/v1/health`
- `GET /api/v1/ready`
- `GET /api/v1/demand/forecasts`
- `GET /api/v1/merchants`
- `GET /api/v1/merchants/{merchant_id}/overview`
- `GET /api/v1/merchants/{merchant_id}/forecast`
- `GET /api/v1/merchants/{merchant_id}/churn-risk`
- `GET /api/v1/merchants/{merchant_id}/benchmark`
- `GET /api/v1/merchants/{merchant_id}/recommendations`
- `GET /api/v1/agents`
- `GET /api/v1/agents/{agent_id}/overview`
- `GET /api/v1/agents/{agent_id}/liquidity-forecast`
- `GET /api/v1/agents/{agent_id}/performance`
- `GET /api/v1/agents/{agent_id}/anomalies`
- `GET /api/v1/locations/opportunities`

## Serving Constraints

- Merchant demand is a category-level next-day point forecast, inherited by merchants from their canonical category. It is not merchant-specific, hourly, or an interval forecast.
- Agent liquidity serves validated next-day outputs only (`2.0-cleaned-next-day`). `liquidity_limit` is exposed as a capacity proxy. Stress bands are not shortage probabilities, and recommended-cash coverage is not accuracy.
- Benchmarking and growth are peer/rule decision support, not probabilities or causal effects.
- Agent operational flags are peer-relative review signals, not fraud detection.
- Locations have no real GPS coordinates; the API does not return coordinates.
- All records and scores are synthetic. Consequential actions require human review.