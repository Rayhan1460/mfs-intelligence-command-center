from collections.abc import Callable, Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.models import User
from app.db.session import get_db
from app.main import app
from app.security.passwords import hash_password
from app.security.throttle import reset_login_throttle

TEST_PASSWORD = "phase3-test-only-password"
TEST_ACCOUNTS = {
    "ADMIN": ("admin@example.com", "Test Admin", None, None, True),
    "ANALYST": ("analyst@example.com", "Test Analyst", None, None, True),
    "REGIONAL_MANAGER": ("manager@example.com", "Test Manager", None, None, True),
    "JUDGE": ("judge@example.com", "Test Judge", None, None, True),
    "MERCHANT": ("merchant@example.com", "Test Merchant", "merchant", "MRC000001", True),
    "OTHER_MERCHANT": ("merchant-other@example.com", "Other Merchant", "merchant", "MRC000002", True),
    "AGENT": ("agent@example.com", "Test Agent", "agent", "AGT00001", True),
    "OTHER_AGENT": ("agent-other@example.com", "Other Agent", "agent", "AGT00002", True),
    "INACTIVE": ("inactive@example.com", "Inactive User", None, None, False),
}


@pytest.fixture(scope="session")
def test_password_hash() -> str:
    return hash_password(TEST_PASSWORD)


@pytest.fixture
def isolated_database(test_password_hash: str) -> Generator:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        for role, (email, display_name, linked_type, linked_id, active) in TEST_ACCOUNTS.items():
            effective_role = linked_type.upper() if linked_type else role
            if effective_role not in {"ADMIN", "ANALYST", "REGIONAL_MANAGER", "MERCHANT", "AGENT", "JUDGE"}:
                effective_role = "ANALYST"
            session.add(
                User(
                    id=str(uuid4()),
                    email=email,
                    password_hash=test_password_hash,
                    role=effective_role,
                    is_active=active,
                    display_name=display_name,
                    linked_entity_type=linked_type,
                    linked_entity_id=linked_id,
                )
            )
        session.commit()

    def override_get_db():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    reset_login_throttle()
    yield engine
    app.dependency_overrides.pop(get_db, None)
    engine.dispose()
    reset_login_throttle()


@pytest.fixture
def make_client(isolated_database) -> Generator[Callable[[str | None], TestClient], None, None]:
    _ = isolated_database
    clients: list[TestClient] = []

    def create(role: str | None = "ADMIN") -> TestClient:
        client = TestClient(app, raise_server_exceptions=False)
        clients.append(client)
        if role is not None:
            account = TEST_ACCOUNTS[role]
            response = client.post(
                "/api/v1/auth/login",
                json={"email": account[0], "password": TEST_PASSWORD},
            )
            assert response.status_code == 200, response.text
        return client

    yield create
    for client in clients:
        client.close()


@pytest.fixture
def client(make_client) -> TestClient:
    return make_client("ADMIN")