from fastapi.testclient import TestClient

from app.api.v1.endpoints import health
from app.main import app

client = TestClient(app)


def test_health_does_not_require_database() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_reports_database_available(monkeypatch) -> None:
    monkeypatch.setattr(health, "is_database_ready", lambda: True)

    response = client.get("/api/v1/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "dependencies": {"database": "available"},
    }


def test_ready_reports_database_unavailable(monkeypatch) -> None:
    monkeypatch.setattr(health, "is_database_ready", lambda: False)

    response = client.get("/api/v1/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "dependencies": {"database": "unavailable"},
    }