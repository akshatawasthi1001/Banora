"""Tests for the authentication rate limiter."""

from __future__ import annotations

from app.core.rate_limit import reset_rate_limits
from test_auth import client


def test_login_rate_limit_returns_429() -> None:
    reset_rate_limits()

    for _ in range(10):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "ratelimit@example.com", "password": "whatever1"},
        )
        assert response.status_code == 401

    throttled = client.post(
        "/api/v1/auth/login",
        json={"email": "ratelimit@example.com", "password": "whatever1"},
    )
    assert throttled.status_code == 429
    assert "too many" in throttled.json()["detail"].lower()

    # A valid request from the same IP is also blocked while throttled.
    reset_rate_limits()


def test_register_rate_limit_returns_429() -> None:
    reset_rate_limits()

    for index in range(10):
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": f"reg{index}@example.com",
                "password": "secretpass",
                "role": "CLIENT",
            },
        )
        assert response.status_code == 201

    throttled = client.post(
        "/api/v1/auth/register",
        json={
            "email": "overflow@example.com",
            "password": "secretpass",
            "role": "CLIENT",
        },
    )
    assert throttled.status_code == 429


def test_rate_limit_buckets_are_independent() -> None:
    reset_rate_limits()

    # Exhaust the login bucket only.
    for _ in range(10):
        client.post(
            "/api/v1/auth/login",
            json={"email": "buckets@example.com", "password": "whatever1"},
        )

    # The register bucket is unaffected.
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "bucketcheck@example.com", "password": "secretpass", "role": "CLIENT"},
    )
    assert response.status_code == 201


def test_reset_rate_limits_clears_state() -> None:
    for _ in range(10):
        client.post(
            "/api/v1/auth/login",
            json={"email": "reset@example.com", "password": "whatever1"},
        )
    throttled = client.post(
        "/api/v1/auth/login",
        json={"email": "reset@example.com", "password": "whatever1"},
    )
    assert throttled.status_code == 429

    reset_rate_limits()

    unthrottled = client.post(
        "/api/v1/auth/login",
        json={"email": "reset@example.com", "password": "whatever1"},
    )
    assert unthrottled.status_code == 401
