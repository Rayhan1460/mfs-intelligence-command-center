from fastapi.testclient import TestClient

from app.main import app
from app.repositories.artifacts import (
    ArtifactRepository,
    ArtifactUnavailableError,
    get_artifact_repository,
)
from app.services.intelligence import _churn_by_merchant

client = TestClient(app)
FORBIDDEN_RESPONSE_KEYS = {
    "actual_churn",
    "predicted_churn",
    "churn_30d",
    "churn_60d",
    "churn_90d",
    "target_next_day_cashout",
    "cashout_demand_next_1h",
    "liquidity_pressure_next_1h",
    "recommended_cash_covers_actual",
    "latitude",
    "longitude",
    "lat",
    "lon",
}


def assert_no_forbidden_keys(value) -> None:
    if isinstance(value, dict):
        assert FORBIDDEN_RESPONSE_KEYS.isdisjoint(value)
        for child in value.values():
            assert_no_forbidden_keys(child)
    elif isinstance(value, list):
        for child in value:
            assert_no_forbidden_keys(child)


def test_merchant_list_pagination_and_overview() -> None:
    first_page = client.get("/api/v1/merchants", params={"limit": 2, "offset": 0})
    second_page = client.get("/api/v1/merchants", params={"limit": 2, "offset": 2})

    assert first_page.status_code == 200
    assert first_page.json()["total"] == 5000
    assert [row["merchant_id"] for row in first_page.json()["items"]] == [
        "MRC000001",
        "MRC000002",
    ]
    assert second_page.json()["items"][0]["merchant_id"] == "MRC000003"

    overview = client.get("/api/v1/merchants/MRC000001/overview")
    assert overview.status_code == 200
    assert overview.json()["identity"]["merchant_category"] == "Healthcare"
    assert_no_forbidden_keys(overview.json())


def test_demand_category_forecasts_and_merchant_inherited_forecast() -> None:
    forecasts = client.get("/api/v1/demand/forecasts", params={"merchant_category": "Healthcare"})
    assert forecasts.status_code == 200
    assert forecasts.json()["forecast_scope"] == "merchant_category"
    assert forecasts.json()["horizon"] == "next_day"
    assert forecasts.json()["serving_mode"] == "batch"
    assert forecasts.json()["synthetic_data"] is True
    assert all(row["merchant_category"] == "Healthcare" for row in forecasts.json()["items"])

    forecast = client.get("/api/v1/merchants/MRC000001/forecast")
    assert forecast.status_code == 200
    assert forecast.json()["forecast_scope"] == "merchant_category"
    assert forecast.json()["merchant_category"] == "Healthcare"
    assert forecast.json()["horizon"] == "next_day"
    assert_no_forbidden_keys(forecast.json())


def test_churn_benchmark_and_growth_responses() -> None:
    repository = get_artifact_repository()
    churn_matches = _churn_by_merchant(repository)
    assert len(churn_matches) == 771
    matched_id = next(iter(churn_matches))
    churn = client.get(f"/api/v1/merchants/{matched_id}/churn-risk")
    assert churn.status_code == 200
    churn_payload = churn.json()
    assert churn_payload["merchant_id"] == matched_id
    assert churn_payload["churn_probability"] is not None
    assert churn_payload["serving_mode"] == "batch"
    assert "30-day inactivity" in churn_payload["limitations"][0]
    assert_no_forbidden_keys(churn_payload)

    unmatched_id = next(
        row["merchant_id"]
        for row in repository.rows("merchants")
        if row["merchant_id"] not in churn_matches
    )
    unmatched = client.get(f"/api/v1/merchants/{unmatched_id}/churn-risk")
    assert unmatched.status_code == 200
    assert unmatched.json()["intelligence_available"] is False
    assert "churn_probability" not in unmatched.json()

    benchmark = client.get("/api/v1/merchants/MRC000001/benchmark")
    assert benchmark.status_code == 200
    assert benchmark.json()["benchmark_score"] is not None
    assert benchmark.json()["serving_mode"] == "batch"

    growth = client.get("/api/v1/merchants/MRC000001/recommendations")
    assert growth.status_code == 200
    assert growth.json()["growth_opportunity_score"] is not None
    assert growth.json()["serving_mode"] == "batch"
    assert_no_forbidden_keys(growth.json())


def test_agent_list_overview_liquidity_and_performance() -> None:
    agents = client.get("/api/v1/agents", params={"limit": 3})
    assert agents.status_code == 200
    assert agents.json()["total"] == 800
    assert [row["agent_id"] for row in agents.json()["items"]] == [
        "AGT00001",
        "AGT00002",
        "AGT00003",
    ]

    overview = client.get("/api/v1/agents/AGT00001/overview")
    assert overview.status_code == 200
    assert overview.json()["identity"]["location_id"] == "LOC0013"
    assert_no_forbidden_keys(overview.json())

    liquidity = client.get("/api/v1/agents/AGT00001/liquidity-forecast")
    assert liquidity.status_code == 200
    liquidity_payload = liquidity.json()
    assert liquidity_payload["horizon"] == "next_day"
    assert liquidity_payload["model_or_engine_metadata"]["version"] == "2.0-cleaned-next-day"
    assert liquidity_payload["serving_mode"] == "batch"
    assert liquidity_payload["liquidity_limit_capacity_proxy"] is not None
    assert_no_forbidden_keys(liquidity_payload)

    unavailable = client.get(
        "/api/v1/agents/AGT00001/liquidity-forecast",
        params={"target_date": "2099-01-01"},
    )
    assert unavailable.status_code == 200
    assert unavailable.json()["intelligence_available"] is False
    assert "predicted_next_day_cashout" not in unavailable.json()

    performance = client.get("/api/v1/agents/AGT00001/performance")
    assert performance.status_code == 200
    assert performance.json()["performance_score"] is not None


def test_agent_anomalies_are_review_signals_only() -> None:
    anomalies = client.get("/api/v1/agents/AGT00001/anomalies")
    assert anomalies.status_code == 200
    assert anomalies.json()["statement"] == (
        "Abnormal operational activity is a review signal and does not imply fraud."
    )
    assert "fraud" not in " ".join(anomalies.json()["flags"]).casefold()


def test_location_opportunities_and_filters() -> None:
    all_locations = client.get("/api/v1/locations/opportunities")
    assert all_locations.status_code == 200
    assert all_locations.json()["total"] == 120
    assert_no_forbidden_keys(all_locations.json())

    filtered = client.get(
        "/api/v1/locations/opportunities",
        params={"district": "Dhaka", "area_type": "Urban", "expansion_priority": "HIGH"},
    )
    assert filtered.status_code == 200
    assert all(
        row["district"] == "Dhaka"
        and row["area_type"] == "Urban"
        and row["expansion_priority"] == "HIGH"
        for row in filtered.json()["items"]
    )


def test_unknown_entities_and_invalid_queries() -> None:
    unknown_merchant = client.get("/api/v1/merchants/MRC999999/overview")
    unknown_agent = client.get("/api/v1/agents/AGT999999/overview")
    assert unknown_merchant.status_code == 404
    assert unknown_merchant.json()["code"] == "entity_not_found"
    assert unknown_agent.status_code == 404
    assert unknown_agent.json()["code"] == "entity_not_found"

    invalid_limit = client.get("/api/v1/merchants", params={"limit": 0})
    invalid_horizon = client.get(
        "/api/v1/agents/AGT00001/liquidity-forecast", params={"horizon": "48h"}
    )
    invalid_date = client.get(
        "/api/v1/agents/AGT00001/liquidity-forecast", params={"target_date": "tomorrow"}
    )
    assert invalid_limit.status_code == 422
    assert invalid_horizon.status_code == 422
    assert invalid_date.status_code == 422


def test_artifact_and_internal_errors_are_sanitized(monkeypatch) -> None:
    def unavailable(self, name):
        raise ArtifactUnavailableError(f"test artifact {name} unavailable for {type(self).__name__}")

    monkeypatch.setattr(ArtifactRepository, "rows", unavailable)
    missing = client.get("/api/v1/merchants")
    assert missing.status_code == 404
    assert missing.json()["code"] == "intelligence_not_available"
    assert "C:\\" not in missing.text

    def broken(self, name):
        raise RuntimeError(
            f"C:\\private\\source\\{name}; {type(self).__name__}; traceback details"
        )

    monkeypatch.setattr(ArtifactRepository, "rows", broken)
    safe_client = TestClient(app, raise_server_exceptions=False)
    internal = safe_client.get("/api/v1/merchants")
    assert internal.status_code == 500
    assert internal.json()["code"] == "internal_error"
    assert "private" not in internal.text
    assert "traceback" not in internal.text