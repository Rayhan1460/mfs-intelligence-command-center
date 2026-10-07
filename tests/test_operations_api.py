from fastapi.testclient import TestClient

from app.db.models import Intervention
from app.db.session import get_db
from test_intelligence_api import assert_no_forbidden_keys


def test_daily_priorities_default_queue_and_deterministic_ranking(client: TestClient) -> None:
    response = client.get("/api/v1/operations/daily-priorities", params={"limit": 20, "offset": 0})
    assert response.status_code == 200
    data = response.json()

    assert data["source"] == "synthetic"
    assert data["synthetic_data"] is True
    assert data["serving_mode"] == "batch"
    assert "priority_score" in data["scoring_formula"]
    assert data["total"] > 0
    assert len(data["items"]) == 20

    # Verify deterministic ordering: ranks are 1..20 and priority_scores non-increasing
    ranks = [item["priority_rank"] for item in data["items"]]
    scores = [item["priority_score"] for item in data["items"]]
    assert ranks == list(range(1, 21))
    assert scores == sorted(scores, reverse=True)

    # Verify presence of required fields and realistic Bangladesh MFS operations content
    first = data["items"][0]
    assert first["priority_level"] in {"HIGH", "MEDIUM", "LOW"}
    assert first["entity_type"] in {"agent", "merchant"}
    assert first["entity_id"] != ""
    assert first["district"] != ""
    assert first["reason"] != ""
    assert first["evidence"] != ""
    assert first["recommended_action"] != ""
    assert first["expected_value_label"] != ""
    assert len(first["source_modules"]) >= 1
    assert "future_data_required" in first
    assert isinstance(first["future_data_required"], list)

    # Verify no forbidden keys leaked
    assert_no_forbidden_keys(data)


def test_daily_priorities_entity_type_and_priority_filters(client: TestClient) -> None:
    agent_res = client.get("/api/v1/operations/daily-priorities", params={"entity_type": "agent", "limit": 10})
    assert agent_res.status_code == 200
    assert all(item["entity_type"] == "agent" for item in agent_res.json()["items"])

    merchant_res = client.get("/api/v1/operations/daily-priorities", params={"entity_type": "merchant", "limit": 10})
    assert merchant_res.status_code == 200
    assert all(item["entity_type"] == "merchant" for item in merchant_res.json()["items"])

    high_res = client.get("/api/v1/operations/daily-priorities", params={"priority": "HIGH", "limit": 15})
    assert high_res.status_code == 200
    assert all(item["priority_level"] == "HIGH" for item in high_res.json()["items"])
    assert all(item["priority_score"] >= 75.0 for item in high_res.json()["items"])

    med_res = client.get("/api/v1/operations/daily-priorities", params={"priority": "MEDIUM", "limit": 15})
    assert med_res.status_code == 200
    assert all(item["priority_level"] == "MEDIUM" for item in med_res.json()["items"])
    assert all(50.0 <= item["priority_score"] < 75.0 for item in med_res.json()["items"])


def test_daily_priorities_district_filter_and_empty_state(client: TestClient) -> None:
    dhaka_res = client.get("/api/v1/operations/daily-priorities", params={"district": "Dhaka", "limit": 10})
    assert dhaka_res.status_code == 200
    assert dhaka_res.json()["total"] > 0
    assert all("dhaka" in item["district"].casefold() for item in dhaka_res.json()["items"])

    empty_res = client.get("/api/v1/operations/daily-priorities", params={"district": "NonExistentDistrictName99"})
    assert empty_res.status_code == 200
    assert empty_res.json()["total"] == 0
    assert len(empty_res.json()["items"]) == 0


def test_daily_priorities_pagination(client: TestClient) -> None:
    page1 = client.get("/api/v1/operations/daily-priorities", params={"limit": 5, "offset": 0})
    page2 = client.get("/api/v1/operations/daily-priorities", params={"limit": 5, "offset": 5})

    assert page1.status_code == 200
    assert page2.status_code == 200
    p1_ids = [item["entity_id"] for item in page1.json()["items"]]
    p2_ids = [item["entity_id"] for item in page2.json()["items"]]
    assert len(set(p1_ids).intersection(set(p2_ids))) == 0


def test_morning_briefing_endpoint(client: TestClient) -> None:
    response = client.get("/api/v1/operations/briefing")
    assert response.status_code == 200
    briefing = response.json()

    assert briefing["total_actions_flagged"] > 0
    assert briefing["high_priority_count"] > 0
    assert briefing["agent_cases_count"] > 0
    assert briefing["merchant_cases_count"] > 0
    assert briefing["top_operational_reason"] != ""
    assert briefing["top_recommended_action"] != ""
    assert "Today" in briefing["briefing_text_en"]
    assert "আজকে" in briefing["briefing_text_bn"]
    assert_no_forbidden_keys(briefing)


def test_production_data_requirements_endpoint(client: TestClient) -> None:
    response = client.get("/api/v1/operations/production-data-requirements")
    assert response.status_code == 200
    reqs = response.json()
    assert len(reqs) >= 5
    assert any("Float" in r["data_domain"] for r in reqs)
    assert any("QR" in r["data_domain"] for r in reqs)
    assert any("Failed Transaction" in r["data_domain"] for r in reqs)
    assert any("Holiday" in r["data_domain"] for r in reqs)


def test_action_review_integration(client: TestClient) -> None:
    # 1. Fetch top priority action
    res = client.get("/api/v1/operations/daily-priorities", params={"limit": 1})
    assert res.status_code == 200
    top_item = res.json()["items"][0]
    target_type = top_item["entity_type"]
    target_id = top_item["entity_id"]

    csrf_token = client.cookies.get("mfs_csrf")
    headers = {"X-CSRF-Token": csrf_token} if csrf_token else {}
    post_res = client.post(
        "/api/v1/interventions",
        json={
            "target_type": target_type,
            "target_id": target_id,
            "capability": "daily_operations_priority",
            "recommended_action": top_item["recommended_action"],
            "reason": top_item["reason"],
        },
        headers=headers,
    )
    assert post_res.status_code == 201
    created_id = post_res.json()["id"]

    # 3. Daily priorities now reflects PROPOSED status for this item
    updated_res = client.get("/api/v1/operations/daily-priorities", params={"limit": 1})
    assert updated_res.status_code == 200
    updated_first = updated_res.json()["items"][0]
    assert updated_first["entity_id"] == target_id
    assert updated_first["review_status"] == "PROPOSED"
    assert updated_first["intervention_id"] == created_id
