from __future__ import annotations

import uuid

import pytest

from app.core.security import create_access_token
from app.db.base import Base
from app.models import UserRole

from test_auth import TestingSessionLocal, client
from test_contractors import create_profile, register_user


@pytest.fixture(autouse=True)
def reset_db() -> None:
    bind = TestingSessionLocal.kw["bind"]
    Base.metadata.drop_all(bind=bind)
    Base.metadata.create_all(bind=bind)


def project_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "title": "Austin Residence",
        "description": "A modern residential project in Austin",
        "project_type": "RESIDENTIAL",
        "city": "Austin",
        "state": "Texas",
        "country": "USA",
        "latitude": 30.2672,
        "longitude": -97.7431,
        "plot_area_sqft": 2500,
        "built_up_area_sqft": 1800,
        "floors": 2,
        "budget_min": 100000,
        "budget_max": 250000,
        "start_date": "2026-01-01",
        "completion_date": "2026-12-31",
        "status": "ONGOING",
    }
    payload.update(overrides)
    return payload


def create_project(
    email: str = "contractor@example.com",
    **overrides: object,
) -> tuple[dict[str, object], str]:
    _, token = create_profile(email)
    response = client.post(
        "/api/v1/projects",
        json=project_payload(**overrides),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    return response.json(), token


def test_contractor_can_create_project() -> None:
    project, _ = create_project()

    assert project["title"] == "Austin Residence"
    assert project["project_type"] == "RESIDENTIAL"
    assert "contractor_profile_id" not in project
    assert "password_hash" not in project


def test_unauthenticated_create_returns_401() -> None:
    response = client.post("/api/v1/projects", json=project_payload())

    assert response.status_code == 401


def test_client_cannot_create_project() -> None:
    _, token = register_user("client@example.com", "CLIENT")

    response = client.post(
        "/api/v1/projects",
        json=project_payload(),
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403


def test_create_without_contractor_profile_returns_404() -> None:
    _, token = register_user("no-profile@example.com", "CONTRACTOR")

    response = client.post(
        "/api/v1/projects",
        json=project_payload(),
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404


def test_contractor_can_list_and_get_own_projects() -> None:
    project, token = create_project()

    list_response = client.get(
        "/api/v1/projects/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    detail_response = client.get(
        f"/api/v1/projects/me/{project['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == project["id"]


def test_private_project_endpoint_requires_authentication() -> None:
    response = client.get("/api/v1/projects/me")

    assert response.status_code == 401


def test_contractor_can_update_project() -> None:
    project, token = create_project()

    response = client.patch(
        f"/api/v1/projects/me/{project['id']}",
        json={"title": "Updated Residence", "budget_max": 300000},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Updated Residence"
    assert response.json()["budget_max"] == 300000
    assert response.json()["city"] == "Austin"


def test_contractor_can_delete_project() -> None:
    project, token = create_project()

    response = client.delete(
        f"/api/v1/projects/me/{project['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    detail_response = client.get(f"/api/v1/projects/{project['id']}")

    assert response.status_code == 204
    assert detail_response.status_code == 404


def test_contractor_cannot_access_another_contractors_project() -> None:
    project, _ = create_project("first@example.com")
    _, second_token = create_profile("second@example.com")

    response = client.get(
        f"/api/v1/projects/me/{project['id']}",
        headers={"Authorization": f"Bearer {second_token}"},
    )

    assert response.status_code == 404


def test_contractor_cannot_update_or_delete_another_contractors_project() -> None:
    project, _ = create_project("first@example.com")
    _, second_token = create_profile("second@example.com")

    update_response = client.patch(
        f"/api/v1/projects/me/{project['id']}",
        json={"title": "Tampered"},
        headers={"Authorization": f"Bearer {second_token}"},
    )
    delete_response = client.delete(
        f"/api/v1/projects/me/{project['id']}",
        headers={"Authorization": f"Bearer {second_token}"},
    )

    assert update_response.status_code == 404
    assert delete_response.status_code == 404


def test_public_project_list_and_detail_work() -> None:
    project, _ = create_project()

    list_response = client.get("/api/v1/projects")
    detail_response = client.get(f"/api/v1/projects/{project['id']}")

    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == project["id"]
    assert "password_hash" not in list_response.text
    assert "contractor_profile_id" not in list_response.text


def test_public_project_filter_by_contractor() -> None:
    project, _ = create_project()

    response = client.get(
        f"/api/v1/projects?contractor_id={project['contractor_id']}"
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["id"] == project["id"]


def test_unknown_public_project_returns_404() -> None:
    response = client.get(f"/api/v1/projects/{uuid.uuid4()}")

    assert response.status_code == 404


def test_public_filters_work() -> None:
    create_project("a@example.com", city="Austin", state="Texas", project_type="RESIDENTIAL", status="ONGOING")
    create_project("b@example.com", city="Dallas", state="Texas", project_type="COMMERCIAL", status="COMPLETED")
    create_project("c@example.com", city="Miami", state="Florida", project_type="INTERIOR", status="ONGOING")

    assert client.get("/api/v1/projects?city=aUsTiN").json()["total"] == 1
    assert client.get("/api/v1/projects?state=flORida").json()["total"] == 1
    assert client.get("/api/v1/projects?project_type=COMMERCIAL").json()["total"] == 1
    assert client.get("/api/v1/projects?status=COMPLETED").json()["total"] == 1


def test_public_search_and_pagination_work() -> None:
    create_project("a@example.com", title="Oak Villa", description="Luxury build")
    create_project("b@example.com", title="River Office", description="Commercial space")
    create_project("c@example.com", title="Pine Cabin", description="Mountain retreat")

    search_response = client.get("/api/v1/projects?search=luXury")
    page_response = client.get("/api/v1/projects?page=2&page_size=2")

    assert search_response.status_code == 200
    assert search_response.json()["total"] == 1
    assert page_response.status_code == 200
    assert page_response.json()["page"] == 2
    assert page_response.json()["total"] == 3
    assert page_response.json()["total_pages"] == 2
    assert len(page_response.json()["items"]) == 1


def test_project_validation_rejects_invalid_values() -> None:
    _, token = create_profile()
    headers = {"Authorization": f"Bearer {token}"}
    invalid_payloads = [
        {"project_type": "INVALID"},
        {"status": "INVALID"},
        {"plot_area_sqft": -1},
        {"built_up_area_sqft": -1},
        {"floors": 0},
        {"budget_min": 300000, "budget_max": 100000},
        {"start_date": "2027-01-01", "completion_date": "2026-01-01"},
    ]

    for invalid_values in invalid_payloads:
        response = client.post(
            "/api/v1/projects",
            json=project_payload(**invalid_values),
            headers=headers,
        )
        assert response.status_code == 422


def test_project_update_rejects_invalid_merged_ranges() -> None:
    project, token = create_project()
    headers = {"Authorization": f"Bearer {token}"}

    response = client.patch(
        f"/api/v1/projects/me/{project['id']}",
        json={"budget_max": 50000},
        headers=headers,
    )

    assert response.status_code == 422


def test_contractor_profile_id_is_not_accepted() -> None:
    _, token = create_profile()

    response = client.post(
        "/api/v1/projects",
        json=project_payload(contractor_profile_id=str(uuid.uuid4())),
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422
