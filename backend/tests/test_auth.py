from __future__ import annotations

from datetime import timedelta

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.dependencies import require_role
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import User, UserRole

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_db() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_register_success() -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "USER@EXAMPLE.com", "password": "secretpass", "role": "CLIENT"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "user@example.com"
    assert data["role"] == "CLIENT"
    assert data["is_active"] is True
    assert "password_hash" not in data
    assert "password" not in data

    with TestingSessionLocal() as db:
        user = db.query(User).filter_by(email="user@example.com").one()
        assert user.password_hash != "secretpass"
        assert user.role == UserRole.CLIENT


def test_duplicate_email_returns_conflict() -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "password": "secretpass", "role": "CLIENT"},
    )

    response = client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "password": "anotherpass", "role": "CONTRACTOR"},
    )

    assert response.status_code == 409


def test_register_validation_rejects_bad_input() -> None:
    invalid_email = client.post(
        "/api/v1/auth/register",
        json={"email": "not-an-email", "password": "secretpass", "role": "CLIENT"},
    )
    short_password = client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "password": "short", "role": "CLIENT"},
    )

    assert invalid_email.status_code == 422
    assert short_password.status_code == 422


def test_login_success_and_token_shape() -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "password": "secretpass", "role": "CLIENT"},
    )

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "secretpass"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["access_token"]


def test_login_invalid_credentials_and_inactive_user() -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "password": "secretpass", "role": "CLIENT"},
    )

    wrong_password = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "wrongpass"},
    )
    nonexistent = client.post(
        "/api/v1/auth/login",
        json={"email": "missing@example.com", "password": "secretpass"},
    )

    assert wrong_password.status_code == 401
    assert nonexistent.status_code == 401

    with TestingSessionLocal() as db:
        user = db.query(User).filter_by(email="user@example.com").one()
        user.is_active = False
        db.commit()

    inactive = client.post(
        "/api/v1/auth/login",
        json={"email": "user@example.com", "password": "secretpass"},
    )
    assert inactive.status_code == 401


def test_jwt_validation_flow() -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "password": "secretpass", "role": "CLIENT"},
    )
    user_id = response.json()["id"]

    valid_token = create_access_token(subject=user_id, role=UserRole.CLIENT)
    valid_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {valid_token}"},
    )
    assert valid_response.status_code == 200
    assert valid_response.json()["email"] == "user@example.com"

    expired_token = create_access_token(
        subject=user_id,
        role=UserRole.CLIENT,
        expires_delta=timedelta(minutes=-5),
    )
    expired_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert expired_response.status_code == 401

    malformed = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert malformed.status_code == 401

    missing = client.get("/api/v1/auth/me")
    assert missing.status_code == 401

    invalid_signature = create_access_token(subject=user_id, role=UserRole.CLIENT)
    token_parts = invalid_signature.split(".")
    token_parts[2] = ("A" if token_parts[2][0] != "A" else "B") + token_parts[2][1:]
    invalid_signature = ".".join(token_parts)
    invalid_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {invalid_signature}"},
    )
    assert invalid_response.status_code == 401

    deleted_user = create_access_token(subject="00000000-0000-0000-0000-000000000001", role=UserRole.CLIENT)
    missing_user_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {deleted_user}"},
    )
    assert missing_user_response.status_code == 401


def test_me_returns_safe_user_without_sensitive_fields() -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "user@example.com", "password": "secretpass", "role": "CONTRACTOR"},
    )
    token = create_access_token(subject=response.json()["id"], role=UserRole.CONTRACTOR)

    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert me_response.status_code == 200
    payload = me_response.json()
    assert payload["role"] == "CONTRACTOR"
    assert "password_hash" not in payload
    assert "password" not in payload


def test_require_role_dependency() -> None:
    contractor = User(
        email="contractor@example.com",
        password_hash="hash",
        role=UserRole.CONTRACTOR,
        is_active=True,
    )
    client_user = User(
        email="client@example.com",
        password_hash="hash",
        role=UserRole.CLIENT,
        is_active=True,
    )

    dependency = require_role(UserRole.CONTRACTOR)

    assert dependency(current_user=contractor) == contractor

    with pytest.raises(HTTPException) as exc_info:
        dependency(current_user=client_user)

    assert exc_info.value.status_code == 403
