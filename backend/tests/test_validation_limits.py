"""Tests for input-validation hardening added in the security audit."""

from __future__ import annotations

from test_auth import client


def _register_and_login(role: str = "CONTRACTOR") -> dict[str, str]:
    email = f"limits-{role.lower()}-{id(object())}@example.com"
    register = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "secretpass", "role": role},
    )
    user_id = register.json()["id"]
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "secretpass"},
    )
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "x-user-id": user_id}


def test_register_rejects_oversized_password() -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "bigpass@example.com", "password": "a" * 1025, "role": "CLIENT"},
    )
    assert response.status_code == 422


def test_contractor_profile_rejects_oversized_fields() -> None:
    headers = _register_and_login("CONTRACTOR")

    response = client.post(
        "/api/v1/contractors/profile",
        json={
            "name": "x" * 201,
            "city": "Town",
            "state": "State",
            "country": "Country",
        },
        headers=headers,
    )
    assert response.status_code == 422

    response = client.post(
        "/api/v1/contractors/profile",
        json={
            "name": "Ok Name",
            "bio": "y" * 5001,
            "city": "Town",
            "state": "State",
            "country": "Country",
        },
        headers=headers,
    )
    assert response.status_code == 422


def test_contractor_profile_rejects_non_http_image_url() -> None:
    headers = _register_and_login("CONTRACTOR")

    response = client.post(
        "/api/v1/contractors/profile",
        json={
            "name": "Image Tester",
            "city": "Town",
            "state": "State",
            "country": "Country",
            "profile_image_url": "javascript:alert(1)",
        },
        headers=headers,
    )
    assert response.status_code == 422

    ok = client.post(
        "/api/v1/contractors/profile",
        json={
            "name": "Image Tester",
            "city": "Town",
            "state": "State",
            "country": "Country",
            "profile_image_url": "https://example.com/photo.jpg",
        },
        headers=headers,
    )
    assert ok.status_code == 201


def test_project_rejects_oversized_title_and_description() -> None:
    headers = _register_and_login("CONTRACTOR")
    profile = client.post(
        "/api/v1/contractors/profile",
        json={
            "name": "Project Tester",
            "city": "Town",
            "state": "State",
            "country": "Country",
        },
        headers=headers,
    )
    assert profile.status_code == 201

    response = client.post(
        "/api/v1/projects",
        json={
            "title": "t" * 201,
            "project_type": "RESIDENTIAL",
            "city": "Town",
            "state": "State",
            "country": "Country",
        },
        headers=headers,
    )
    assert response.status_code == 422

    response = client.post(
        "/api/v1/projects",
        json={
            "title": "Valid title",
            "description": "d" * 10001,
            "project_type": "RESIDENTIAL",
            "city": "Town",
            "state": "State",
            "country": "Country",
        },
        headers=headers,
    )
    assert response.status_code == 422
