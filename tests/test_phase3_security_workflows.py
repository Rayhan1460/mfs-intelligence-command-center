import hashlib
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import AuthSession, AuditEvent, Feedback, Intervention, User
from app.security.dependencies import hash_secret
from conftest import TEST_ACCOUNTS, TEST_PASSWORD


def csrf_headers(client: TestClient) -> dict[str, str]:
    token = client.cookies.get("mfs_csrf")
    return {"X-CSRF-Token": token} if token else {}


def test_auth_login_password_hash_session_hash_cookie_me_and_logout(make_client, isolated_database):
    client = make_client(None)
    email = TEST_ACCOUNTS["ADMIN"][0]
    response = client.post("/api/v1/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "ADMIN"
    assert "token" not in response.json()
    assert "password_hash" not in response.json()

    cookie_headers = response.headers.get_list("set-cookie")
    session_cookie = next(header for header in cookie_headers if settings.session_cookie_name in header)
    csrf_cookie = next(header for header in cookie_headers if "mfs_csrf=" in header)
    assert "httponly" in session_cookie.casefold()
    assert "httponly" not in csrf_cookie.casefold()
    raw_token = client.cookies.get(settings.session_cookie_name)

    with Session(isolated_database) as session:
        user = session.scalar(select(User).where(User.email == email))
        auth_session = session.scalar(select(AuthSession).where(AuthSession.user_id == user.id))
        assert user.password_hash != TEST_PASSWORD
        assert user.password_hash.startswith("$argon2")
        assert auth_session.token_hash == hashlib.sha256(raw_token.encode()).hexdigest()
        assert auth_session.token_hash != raw_token
        assert auth_session.csrf_token_hash == hash_secret(client.cookies.get("mfs_csrf"))

    current = client.get("/api/v1/me")
    assert current.status_code == 200
    assert current.json()["email"] == email

    logout = client.post("/api/v1/auth/logout", headers=csrf_headers(client))
    assert logout.status_code == 200
    assert logout.json() == {"status": "logged_out"}
    assert client.get("/api/v1/me").status_code == 401
    with Session(isolated_database) as session:
        revoked = session.scalar(select(AuthSession).where(AuthSession.user_id == user.id))
        assert revoked.revoked_at is not None
        events = session.scalars(select(AuditEvent)).all()
        assert {event.event_type for event in events} >= {"LOGIN_SUCCESS", "LOGOUT"}
        assert all(raw_token not in str(event.metadata_json) for event in events)


def test_login_failure_inactive_user_throttling_and_audit(make_client, isolated_database):
    client = make_client(None)
    unknown = client.post(
        "/api/v1/auth/login",
        json={"email": TEST_ACCOUNTS["ADMIN"][0], "password": "wrong-password"},
    )
    assert unknown.status_code == 401
    assert unknown.json()["code"] == "invalid_credentials"

    inactive = client.post(
        "/api/v1/auth/login",
        json={"email": TEST_ACCOUNTS["INACTIVE"][0], "password": TEST_PASSWORD},
    )
    assert inactive.status_code == 401

    for _ in range(5):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": TEST_ACCOUNTS["ADMIN"][0], "password": "wrong-password"},
        )
    assert response.status_code == 429
    with Session(isolated_database) as session:
        assert session.scalar(select(AuditEvent.event_type).where(AuditEvent.event_type == "LOGIN_FAILURE"))


def test_unauthenticated_intelligence_and_csrf_required(make_client):
    anonymous = make_client(None)
    assert anonymous.get("/api/v1/merchants").status_code == 401
    assert anonymous.get("/api/v1/health").status_code == 200

    analyst = make_client("ANALYST")
    body = {
        "target_type": "merchant",
        "target_id": "MRC000001",
        "capability": "merchant_growth",
        "recommended_action": "Review the supplied recommendation.",
        "reason": "Human review proposal for testing.",
    }
    denied = analyst.post("/api/v1/interventions", json=body)
    assert denied.status_code == 403
    accepted = analyst.post("/api/v1/interventions", json=body, headers=csrf_headers(analyst))
    assert accepted.status_code == 201


def test_cookie_auth_cors_preflight_allows_csrf_header(make_client):
    client = make_client(None)
    response = client.options(
        "/api/v1/interventions",
        headers={
            "Origin": settings.frontend_origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-csrf-token",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-credentials"] == "true"
    assert response.headers["access-control-allow-origin"] == settings.frontend_origin
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "x-csrf-token" in response.headers["access-control-allow-headers"].casefold()


def test_expired_session_is_rejected(make_client, isolated_database):
    client = make_client("ADMIN")
    raw_token = client.cookies.get(settings.session_cookie_name)
    with Session(isolated_database) as session:
        auth_session = session.scalar(select(AuthSession).where(AuthSession.token_hash == hash_secret(raw_token)))
        auth_session.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        session.commit()
    assert client.get("/api/v1/me").status_code == 401


def test_judge_read_only_analyst_proposal_manager_approval_and_admin_action(make_client):
    proposal = {
        "target_type": "agent",
        "target_id": "AGT00001",
        "capability": "agent_performance",
        "recommended_action": "Review the peer-relative signal.",
        "reason": "A human operator should review this signal.",
    }
    judge = make_client("JUDGE")
    assert judge.get("/api/v1/locations/opportunities").status_code == 200
    assert judge.get("/api/v1/admin/models").status_code == 200
    assert judge.post("/api/v1/interventions", json=proposal, headers=csrf_headers(judge)).status_code == 403

    analyst = make_client("ANALYST")
    created = analyst.post("/api/v1/interventions", json=proposal, headers=csrf_headers(analyst))
    assert created.status_code == 201
    intervention_id = created.json()["id"]
    analyst_decision = analyst.patch(
        f"/api/v1/interventions/{intervention_id}",
        json={"status": "APPROVED"},
        headers=csrf_headers(analyst),
    )
    assert analyst_decision.status_code == 403

    manager = make_client("REGIONAL_MANAGER")
    approved = manager.patch(
        f"/api/v1/interventions/{intervention_id}",
        json={"status": "APPROVED"},
        headers=csrf_headers(manager),
    )
    assert approved.status_code == 200
    assert approved.json()["approved_by"] is not None
    started = manager.patch(
        f"/api/v1/interventions/{intervention_id}",
        json={"status": "IN_PROGRESS"},
        headers=csrf_headers(manager),
    )
    assert started.json()["status"] == "IN_PROGRESS"
    completed = manager.patch(
        f"/api/v1/interventions/{intervention_id}",
        json={"status": "COMPLETED"},
        headers=csrf_headers(manager),
    )
    assert completed.json()["status"] == "COMPLETED"
    invalid = manager.patch(
        f"/api/v1/interventions/{intervention_id}",
        json={"status": "APPROVED"},
        headers=csrf_headers(manager),
    )
    assert invalid.status_code == 422

    admin = make_client("ADMIN")
    admin_proposal = admin.post("/api/v1/interventions", json=proposal, headers=csrf_headers(admin))
    assert admin_proposal.status_code == 201
    assert admin.patch(
        f"/api/v1/interventions/{admin_proposal.json()['id']}",
        json={"status": "REJECTED"},
        headers=csrf_headers(admin),
    ).status_code == 200


def test_merchant_and_agent_entity_scope(make_client):
    merchant = make_client("MERCHANT")
    own = merchant.get("/api/v1/merchants/MRC000001/overview")
    cross = merchant.get("/api/v1/merchants/MRC000002/overview")
    assert own.status_code == 200
    assert cross.status_code == 403
    merchant_list = merchant.get("/api/v1/merchants")
    assert merchant_list.json()["total"] == 1
    assert merchant_list.json()["items"][0]["merchant_id"] == "MRC000001"
    assert merchant.get("/api/v1/agents").status_code == 403

    agent = make_client("AGENT")
    assert agent.get("/api/v1/agents/AGT00001/overview").status_code == 200
    assert agent.get("/api/v1/agents/AGT00002/overview").status_code == 403
    assert agent.get("/api/v1/merchants").status_code == 403


def test_intervention_list_get_target_validation_and_csrf(make_client, isolated_database):
    analyst = make_client("ANALYST")
    payload = {
        "target_type": "merchant",
        "target_id": "MRC000001",
        "capability": "merchant_benchmark",
        "recommended_action": "Review peer context.",
        "reason": "Proposal requires human assessment.",
    }
    no_csrf = analyst.post("/api/v1/interventions", json=payload, headers={})
    assert no_csrf.status_code == 403
    invalid_target = analyst.post(
        "/api/v1/interventions",
        json={**payload, "target_id": "MRC999999"},
        headers=csrf_headers(analyst),
    )
    assert invalid_target.status_code == 404
    created = analyst.post("/api/v1/interventions", json=payload, headers=csrf_headers(analyst))
    intervention_id = created.json()["id"]
    assert analyst.get("/api/v1/interventions").json()["total"] == 1
    assert analyst.get(f"/api/v1/interventions/{intervention_id}").status_code == 200
    assert analyst.patch(
        f"/api/v1/interventions/{intervention_id}",
        json={"status": "COMPLETED"},
        headers=csrf_headers(analyst),
    ).status_code == 403
    with Session(isolated_database) as session:
        assert session.scalar(select(Intervention).where(Intervention.id == intervention_id)).status == "PROPOSED"


def test_feedback_submit_permissions_scope_and_audit(make_client, isolated_database):
    analyst = make_client("ANALYST")
    payload = {
        "entity_type": "merchant",
        "entity_id": "MRC000001",
        "capability": "merchant_growth",
        "intelligence_reference": {"source": "synthetic", "reference_id": "batch-row-1"},
        "helpful": True,
        "comment": "Reviewed by an analyst.",
    }
    denied_without_csrf = analyst.post("/api/v1/feedback", json=payload)
    assert denied_without_csrf.status_code == 403
    created = analyst.post("/api/v1/feedback", json=payload, headers=csrf_headers(analyst))
    assert created.status_code == 201
    assert created.json()["created_by"] == analyst.get("/api/v1/me").json()["id"]

    judge = make_client("JUDGE")
    assert judge.get("/api/v1/feedback").json()["total"] == 1
    assert judge.post("/api/v1/feedback", json=payload, headers=csrf_headers(judge)).status_code == 403
    merchant = make_client("MERCHANT")
    own_feedback = merchant.get("/api/v1/feedback")
    assert own_feedback.json()["total"] == 1
    assert merchant.post("/api/v1/feedback", json=payload, headers=csrf_headers(merchant)).status_code == 403

    invalid_context = analyst.post(
        "/api/v1/feedback",
        json={**payload, "intelligence_reference": {"session_token": "not-allowed"}},
        headers=csrf_headers(analyst),
    )
    assert invalid_context.status_code == 422
    with Session(isolated_database) as session:
        assert session.scalar(select(Feedback.id)) is not None
        assert session.scalar(select(AuditEvent.event_type).where(AuditEvent.event_type == "FEEDBACK_CREATED"))


def test_model_registry_seven_documented_capabilities_and_admin_audit(make_client, isolated_database):
    judge = make_client("JUDGE")
    response = judge.get("/api/v1/admin/models")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 7
    by_name = {item["capability"]: item for item in payload["items"]}
    assert by_name["Merchant Demand Forecasting"]["horizon"] == "next_day"
    assert "deterministic" in " ".join(by_name["Merchant Churn Prediction"]["limitations"])
    assert "not shortage probabilities" in " ".join(by_name["Agent Liquidity Intelligence"]["limitations"])
    assert by_name["Agent Performance Intelligence"]["engine_type"] == "Rule/percentile engine"
    assert "No real GPS" in " ".join(by_name["Location Intelligence"]["limitations"])
    assert all("confidence" not in item for item in payload["items"])
    assert judge.get("/api/v1/admin/models").status_code == 200
    assert judge.post("/api/v1/interventions", json={}, headers=csrf_headers(judge)).status_code == 403

    analyst = make_client("ANALYST")
    assert analyst.get("/api/v1/admin/models").status_code == 403
    admin = make_client("ADMIN")
    assert admin.get("/api/v1/admin/models").status_code == 200
    with Session(isolated_database) as session:
        event = session.scalar(select(AuditEvent).where(AuditEvent.event_type == "PRIVILEGED_ACCESS"))
        assert event is not None
        assert event.metadata_json == {"operation": "read"}


def test_production_session_cookie_is_secure(monkeypatch, make_client):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "session_cookie_secure", False)
    client = make_client(None)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": TEST_ACCOUNTS["ADMIN"][0], "password": TEST_PASSWORD},
    )
    assert response.status_code == 200
    session_cookie = next(
        header for header in response.headers.get_list("set-cookie") if settings.session_cookie_name in header
    )
    assert "secure" in session_cookie.casefold()