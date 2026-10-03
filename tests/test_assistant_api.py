from fastapi.testclient import TestClient

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


def csrf_headers(client: TestClient) -> dict[str, str]:
    token = client.cookies.get("mfs_csrf")
    return {"X-CSRF-Token": token} if token else {}


def test_unauthenticated_request_rejected(make_client) -> None:
    unauthenticated = make_client(None)
    response = unauthenticated.post(
        "/api/v1/assistant/chat",
        json={"message": "Explain MRC000001"},
    )
    assert response.status_code == 401


def test_csrf_protection_enforced(client: TestClient) -> None:
    # Authenticated user without CSRF header should get 403
    response = client.post(
        "/api/v1/assistant/chat",
        json={"message": "Explain MRC000001"},
        # No X-CSRF-Token header
    )
    assert response.status_code == 403


def test_empty_or_whitespace_query(client: TestClient) -> None:
    response = client.post(
        "/api/v1/assistant/chat",
        json={"message": "   "},
        headers=csrf_headers(client),
    )
    assert response.status_code == 200
    data = response.json()
    assert "Please ask a question" in data["answer"]
    assert data["evidence"] == []
    assert data["entities"] == []


def test_merchant_entity_query(client: TestClient) -> None:
    response = client.post(
        "/api/v1/assistant/chat",
        json={"message": "Explain MRC000001"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 200
    data = response.json()
    assert "MRC000001" in data["answer"]
    assert "Healthcare" in data["answer"]
    assert any(e["id"] == "MRC000001" for e in data["entities"])
    assert len(data["evidence"]) >= 3
    assert len(data["limitations"]) >= 1
    assert_no_forbidden_keys(data)


def test_agent_entity_query(client: TestClient) -> None:
    response = client.post(
        "/api/v1/assistant/chat",
        json={"message": "Explain AGT00001"},
        headers=csrf_headers(client),
    )
    assert response.status_code == 200
    data = response.json()
    assert "AGT00001" in data["answer"]
    assert "capacity proxy" in data["answer"].lower()
    assert any(e["id"] == "AGT00001" for e in data["entities"])
    assert len(data["evidence"]) >= 3
    assert len(data["limitations"]) >= 1
    assert_no_forbidden_keys(data)


def test_supported_domain_queries(client: TestClient) -> None:
    headers = csrf_headers(client)

    # Demand outlook
    demand_resp = client.post(
        "/api/v1/assistant/chat",
        json={"message": "Show the demand outlook"},
        headers=headers,
    )
    assert demand_resp.status_code == 200
    demand_data = demand_resp.json()
    assert "demand" in demand_data["answer"].lower()
    assert len(demand_data["evidence"]) >= 1
    assert_no_forbidden_keys(demand_data)

    # Location opportunities
    loc_resp = client.post(
        "/api/v1/assistant/chat",
        json={"message": "Show expansion opportunities"},
        headers=headers,
    )
    assert loc_resp.status_code == 200
    loc_data = loc_resp.json()
    assert "expansion" in loc_data["answer"].lower()
    assert "not real gps" in loc_data["answer"].lower() or "schematic" in loc_data["answer"].lower()
    assert_no_forbidden_keys(loc_data)

    # Churn explanation
    churn_resp = client.post(
        "/api/v1/assistant/chat",
        json={"message": "What is merchant inactivity risk?"},
        headers=headers,
    )
    assert churn_resp.status_code == 200
    assert "inactivity" in churn_resp.json()["answer"].lower()

    # Liquidity explanation
    liq_resp = client.post(
        "/api/v1/assistant/chat",
        json={"message": "What is agent liquidity?"},
        headers=headers,
    )
    assert liq_resp.status_code == 200
    assert "liquidity" in liq_resp.json()["answer"].lower()

    # Models explanation
    model_resp = client.post(
        "/api/v1/assistant/chat",
        json={"message": "What AI models are used?"},
        headers=headers,
    )
    assert model_resp.status_code == 200
    model_data = model_resp.json()
    assert "xgboost" in model_data["answer"].lower()
    assert "lightgbm" in model_data["answer"].lower()
    assert "decision engines" in model_data["answer"].lower()

    # Summary
    summary_resp = client.post(
        "/api/v1/assistant/chat",
        json={"message": "Summarize the latest intelligence"},
        headers=headers,
    )
    assert summary_resp.status_code == 200
    assert "summary" in summary_resp.json()["answer"].lower()


def test_no_fabricated_values_for_nonexistent_entities(client: TestClient) -> None:
    headers = csrf_headers(client)

    # Non-existent merchant
    m_resp = client.post(
        "/api/v1/assistant/chat",
        json={"message": "Explain MRC999999"},
        headers=headers,
    )
    assert m_resp.status_code == 200
    m_data = m_resp.json()
    assert "no verified record was found" in m_data["answer"].lower()
    assert m_data["evidence"] == []
    assert m_data["entities"] == []

    # Non-existent agent
    a_resp = client.post(
        "/api/v1/assistant/chat",
        json={"message": "Explain AGT99999"},
        headers=headers,
    )
    assert a_resp.status_code == 200
    a_data = a_resp.json()
    assert "no verified record was found" in a_data["answer"].lower()
    assert a_data["evidence"] == []
    assert a_data["entities"] == []


def test_rbac_scoped_merchant_access(make_client) -> None:
    merchant_client = make_client("MERCHANT")
    headers = csrf_headers(merchant_client)

    # Own merchant is allowed
    own_resp = merchant_client.post(
        "/api/v1/assistant/chat",
        json={"message": "Explain MRC000001"},
        headers=headers,
    )
    assert own_resp.status_code == 200
    assert "MRC000001" in own_resp.json()["answer"]

    # Other merchant is forbidden
    other_resp = merchant_client.post(
        "/api/v1/assistant/chat",
        json={"message": "Explain MRC000002"},
        headers=headers,
    )
    assert other_resp.status_code == 403

    # Other entity type (agent) is forbidden
    agent_resp = merchant_client.post(
        "/api/v1/assistant/chat",
        json={"message": "Explain AGT00001"},
        headers=headers,
    )
    assert agent_resp.status_code == 403

    # Location opportunities is forbidden for merchant role
    loc_resp = merchant_client.post(
        "/api/v1/assistant/chat",
        json={"message": "Show expansion opportunities"},
        headers=headers,
    )
    assert loc_resp.status_code == 403


def test_rbac_scoped_agent_access(make_client) -> None:
    agent_client = make_client("AGENT")
    headers = csrf_headers(agent_client)

    # Own agent is allowed
    own_resp = agent_client.post(
        "/api/v1/assistant/chat",
        json={"message": "Explain AGT00001"},
        headers=headers,
    )
    assert own_resp.status_code == 200
    assert "AGT00001" in own_resp.json()["answer"]

    # Other agent is forbidden
    other_resp = agent_client.post(
        "/api/v1/assistant/chat",
        json={"message": "Explain AGT00002"},
        headers=headers,
    )
    assert other_resp.status_code == 403

    # Merchant query is forbidden for agent role
    merchant_resp = agent_client.post(
        "/api/v1/assistant/chat",
        json={"message": "Explain MRC000001"},
        headers=headers,
    )
    assert merchant_resp.status_code == 403

    # Demand forecast is forbidden for agent role
    demand_resp = agent_client.post(
        "/api/v1/assistant/chat",
        json={"message": "Show the demand outlook"},
        headers=headers,
    )
    assert demand_resp.status_code == 403
