from __future__ import annotations

import uuid

import pytest

from app.core.security import create_access_token
from app.db.base import Base
from app.models import UserRole

from test_auth import TestingSessionLocal, client


@pytest.fixture(autouse=True)
def reset_db() -> None:
    Base.metadata.drop_all(bind=TestingSessionLocal.kw["bind"])
    Base.metadata.create_all(bind=TestingSessionLocal.kw["bind"])


def register_user(email: str, role: str) -> tuple[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "secretpass", "role": role},
    )
    assert response.status_code == 201
    user_id = response.json()["id"]
    token = create_access_token(subject=user_id, role=UserRole(role))
    return user_id, token


def profile_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "name": "Asha Builder",
        "company_name": "Asha Construction",
        "bio": "Residential construction specialist",
        "profile_image_url": "https://example.com/asha.jpg",
        "phone": "+1-555-0100",
        "city": "Austin",
        "state": "Texas",
        "country": "USA",
        "latitude": 30.2672,
        "longitude": -97.7431,
        "experience_years": 12,
    }
    payload.update(overrides)
    return payload


def create_profile(
    email: str = "contractor@example.com",
    **overrides: object,
) -> tuple[dict[str, object], str]:
    _, token = register_user(email, "CONTRACTOR")
    response = client.post(
        "/api/v1/contractors/profile",
        json=profile_payload(**overrides),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    return response.json(), token


def test_contractor_can_create_profile() -> None:
    profile, _ = create_profile()

    assert profile["name"] == "Asha Builder"
    assert profile["city"] == "Austin"
    assert "user_id" not in profile
    assert "password_hash" not in profile


def test_client_cannot_create_contractor_profile() -> None:
    _, token = register_user("client@example.com", "CLIENT")

    response = client.post(
        "/api/v1/contractors/profile",
        json=profile_payload(),
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


def test_unauthenticated_user_cannot_create_profile() -> None:
    response = client.post("/api/v1/contractors/profile", json=profile_payload())

    assert response.status_code == 401


def test_duplicate_contractor_profile_returns_conflict() -> None:
    _, token = create_profile()

    response = client.post(
        "/api/v1/contractors/profile",
        json=profile_payload(name="Second Name"),
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 409


def test_contractor_can_get_own_profile() -> None:
    profile, token = create_profile()

    response = client.get(
        "/api/v1/contractors/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["id"] == profile["id"]


def test_missing_profile_returns_not_found() -> None:
    _, token = register_user("no-profile@example.com", "CONTRACTOR")

    response = client.get(
        "/api/v1/contractors/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404


def test_contractor_can_patch_own_profile() -> None:
    _, token = create_profile()

    response = client.patch(
        "/api/v1/contractors/me",
        json={"name": "Asha Renovations", "experience_years": 14},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Asha Renovations"
    assert response.json()["experience_years"] == 14


def test_patch_only_updates_supplied_fields() -> None:
    profile, token = create_profile()

    response = client.patch(
        "/api/v1/contractors/me",
        json={"bio": "Updated bio"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["bio"] == "Updated bio"
    assert response.json()["city"] == profile["city"]
    assert response.json()["experience_years"] == profile["experience_years"]


def test_patch_cannot_change_user_id() -> None:
    _, token = create_profile()

    response = client.patch(
        "/api/v1/contractors/me",
        json={"user_id": str(uuid.uuid4()), "name": "Tampered"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


def test_public_contractor_list_works() -> None:
    create_profile()

    response = client.get("/api/v1/contractors")

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert len(response.json()["items"]) == 1
    assert "password_hash" not in response.text


def test_contractor_list_pagination_works() -> None:
    create_profile("one@example.com")
    create_profile("two@example.com", name="Second Builder")
    create_profile("three@example.com", name="Third Builder")

    response = client.get("/api/v1/contractors?page=2&page_size=2")
    data = response.json()

    assert response.status_code == 200
    assert data["page"] == 2
    assert data["page_size"] == 2
    assert data["total"] == 3
    assert data["total_pages"] == 2
    assert len(data["items"]) == 1


def test_city_filter_works() -> None:
    create_profile("austin@example.com", city="Austin")
    create_profile("dallas@example.com", city="Dallas")

    response = client.get("/api/v1/contractors?city=aUsTiN")

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["city"] == "Austin"


def test_state_filter_works() -> None:
    create_profile("texas@example.com", state="Texas")
    create_profile("florida@example.com", state="Florida")

    response = client.get("/api/v1/contractors?state=flORida")

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["state"] == "Florida"


def test_experience_minimum_filter_works() -> None:
    create_profile("junior@example.com", experience_years=3)
    create_profile("senior@example.com", experience_years=15)

    response = client.get("/api/v1/contractors?experience_years_min=10")

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["experience_years"] == 15


def test_search_by_contractor_name_works() -> None:
    create_profile("asha@example.com", name="Asha Builder")
    create_profile(
        "mike@example.com",
        name="Mike Mason",
        company_name="Mason Works",
    )

    response = client.get("/api/v1/contractors?search=asha")

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["name"] == "Asha Builder"


def test_search_by_company_name_works() -> None:
    create_profile("a@example.com", company_name="North Star Homes")
    create_profile("b@example.com", company_name="Southside Builds")

    response = client.get("/api/v1/contractors?search=NORTH STAR")

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["company_name"] == "North Star Homes"


def test_public_contractor_detail_works() -> None:
    profile, _ = create_profile()

    response = client.get(f"/api/v1/contractors/{profile['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == profile["id"]
    assert "password_hash" not in response.text


def test_unknown_contractor_id_returns_not_found() -> None:
    response = client.get(f"/api/v1/contractors/{uuid.uuid4()}")

    assert response.status_code == 404


def test_public_responses_exclude_authentication_fields() -> None:
    profile, _ = create_profile()

    list_response = client.get("/api/v1/contractors")
    detail_response = client.get(f"/api/v1/contractors/{profile['id']}")

    for response in (list_response, detail_response):
        assert "password_hash" not in response.text
        assert "user_id" not in response.text
