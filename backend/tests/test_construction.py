from __future__ import annotations

import uuid

import pytest

from app.db.base import Base
from app.models import ProgressUpdate

from test_auth import TestingSessionLocal, client
from test_contractors import create_profile, register_user
from test_projects import create_project


@pytest.fixture(autouse=True)
def reset_db() -> None:
    bind = TestingSessionLocal.kw["bind"]
    Base.metadata.drop_all(bind=bind)
    Base.metadata.create_all(bind=bind)


def stage_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "name": "Foundation",
        "stage_order": 1,
        "status": "NOT_STARTED",
        "started_at": "2026-01-01T09:00:00Z",
        "completed_at": None,
    }
    payload.update(overrides)
    return payload


def update_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "title": "Foundation completed",
        "description": "The foundation work is complete.",
        "progress_percentage": 100,
        "update_date": "2026-02-01",
    }
    payload.update(overrides)
    return payload


def create_stage(
    email: str = "contractor@example.com",
    **overrides: object,
) -> tuple[dict[str, object], str, str]:
    project, token = create_project(email)
    response = client.post(
        f"/api/v1/projects/me/{project['id']}/stages",
        json=stage_payload(**overrides),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    return project, response.json(), token


def create_update(
    email: str = "contractor@example.com",
    **overrides: object,
) -> tuple[dict[str, object], dict[str, object], dict[str, object], str]:
    project, stage, token = create_stage(email)
    response = client.post(
        f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}/updates",
        json=update_payload(**overrides),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    return project, stage, response.json(), token


def test_public_stage_list_and_ordering() -> None:
    project, _, token = create_stage()
    for order in (3, 2):
        response = client.post(
            f"/api/v1/projects/me/{project['id']}/stages",
            json=stage_payload(name=f"Stage {order}", stage_order=order),
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/stages")

    assert response.status_code == 200
    assert [item["stage_order"] for item in response.json()] == [1, 2, 3]


def test_public_journey_orders_updates_newest_first() -> None:
    project, stage, _, token = create_update()
    for update_date in ("2026-03-01", "2026-04-01"):
        response = client.post(
            f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}/updates",
            json=update_payload(update_date=update_date, progress_percentage=75),
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/journey")

    assert response.status_code == 200
    journey = response.json()
    assert journey["project_id"] == project["id"]
    assert journey["stages"][0]["id"] == stage["id"]
    assert [item["update_date"] for item in journey["stages"][0]["progress_updates"]] == [
        "2026-04-01",
        "2026-03-01",
        "2026-02-01",
    ]


def test_unknown_project_and_wrong_stage_relationship_return_404() -> None:
    project, stage, token = create_stage()
    unknown_project = client.get(f"/api/v1/projects/{uuid.uuid4()}/stages")
    wrong_stage = client.get(
        f"/api/v1/projects/{uuid.uuid4()}/stages/{stage['id']}/updates"
    )
    private_wrong_project = client.get(
        f"/api/v1/projects/me/{uuid.uuid4()}/stages/{stage['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert unknown_project.status_code == 404
    assert wrong_stage.status_code == 404
    assert private_wrong_project.status_code == 404


def test_stage_crud_and_duplicate_order() -> None:
    project, stage, token = create_stage()
    get_response = client.get(
        f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    update_response = client.patch(
        f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}",
        json={"status": "COMPLETED", "completed_at": "2026-02-01T09:00:00Z"},
        headers={"Authorization": f"Bearer {token}"},
    )
    duplicate_response = client.post(
        f"/api/v1/projects/me/{project['id']}/stages",
        json=stage_payload(name="Duplicate"),
        headers={"Authorization": f"Bearer {token}"},
    )
    delete_response = client.delete(
        f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert get_response.status_code == 200
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "COMPLETED"
    assert duplicate_response.status_code == 409
    assert delete_response.status_code == 204


def test_stage_validation_and_unauthenticated_creation() -> None:
    project, _, token = create_stage()
    invalid_order = client.post(
        f"/api/v1/projects/me/{project['id']}/stages",
        json=stage_payload(stage_order=0),
        headers={"Authorization": f"Bearer {token}"},
    )
    invalid_dates = client.post(
        f"/api/v1/projects/me/{project['id']}/stages",
        json=stage_payload(
            stage_order=2,
            started_at="2026-03-01T09:00:00Z",
            completed_at="2026-02-01T09:00:00Z",
        ),
        headers={"Authorization": f"Bearer {token}"},
    )
    unauthenticated = client.post(
        f"/api/v1/projects/me/{project['id']}/stages",
        json=stage_payload(stage_order=2),
    )

    assert invalid_order.status_code == 422
    assert invalid_dates.status_code == 422
    assert unauthenticated.status_code == 401


def test_progress_crud_and_ordering() -> None:
    project, stage, update, token = create_update()
    get_response = client.get(
        f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}/updates/{update['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    list_response = client.get(
        f"/api/v1/projects/{project['id']}/stages/{stage['id']}/updates"
    )
    patch_response = client.patch(
        f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}/updates/{update['id']}",
        json={"progress_percentage": 90},
        headers={"Authorization": f"Bearer {token}"},
    )
    delete_response = client.delete(
        f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}/updates/{update['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert get_response.status_code == 200
    assert list_response.status_code == 200
    assert list_response.json()[0]["id"] == update["id"]
    assert patch_response.status_code == 200
    assert patch_response.json()["progress_percentage"] == 90
    assert delete_response.status_code == 204


def test_progress_validation_and_unauthenticated_creation() -> None:
    project, stage, _, token = create_update()
    invalid = client.post(
        f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}/updates",
        json=update_payload(progress_percentage=101),
        headers={"Authorization": f"Bearer {token}"},
    )
    unauthenticated = client.post(
        f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}/updates",
        json=update_payload(),
    )

    assert invalid.status_code == 422
    assert unauthenticated.status_code == 401


def test_client_cannot_modify_construction() -> None:
    project, stage, token = create_stage()
    _, client_token = register_user("client@example.com", "CLIENT")
    create_stage_response = client.post(
        f"/api/v1/projects/me/{project['id']}/stages",
        json=stage_payload(stage_order=2),
        headers={"Authorization": f"Bearer {client_token}"},
    )
    update_stage_response = client.patch(
        f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}",
        json={"name": "Nope"},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    delete_stage_response = client.delete(
        f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}",
        headers={"Authorization": f"Bearer {client_token}"},
    )

    assert create_stage_response.status_code == 403
    assert update_stage_response.status_code == 403
    assert delete_stage_response.status_code == 403


def test_contractor_ownership_isolation_for_stage_and_update() -> None:
    project_a, stage_a, update_a, _ = create_update("a@example.com")
    _, contractor_b_token = create_profile("b@example.com")
    stage_path = f"/api/v1/projects/me/{project_a['id']}/stages/{stage_a['id']}"
    update_path = f"{stage_path}/updates/{update_a['id']}"

    stage_update = client.patch(
        stage_path,
        json={"name": "Tampered"},
        headers={"Authorization": f"Bearer {contractor_b_token}"},
    )
    stage_delete = client.delete(
        stage_path,
        headers={"Authorization": f"Bearer {contractor_b_token}"},
    )
    update_create = client.post(
        f"/api/v1/projects/me/{project_a['id']}/stages/{stage_a['id']}/updates",
        json=update_payload(),
        headers={"Authorization": f"Bearer {contractor_b_token}"},
    )
    update_update = client.patch(
        update_path,
        json={"title": "Tampered"},
        headers={"Authorization": f"Bearer {contractor_b_token}"},
    )
    update_delete = client.delete(
        update_path,
        headers={"Authorization": f"Bearer {contractor_b_token}"},
    )

    assert stage_update.status_code == 404
    assert stage_delete.status_code == 404
    assert update_create.status_code == 404
    assert update_update.status_code == 404
    assert update_delete.status_code == 404


def test_deleting_stage_cascades_progress_updates() -> None:
    project, stage, update, token = create_update()
    delete_response = client.delete(
        f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )

    with TestingSessionLocal() as db:
        remaining_update = db.get(ProgressUpdate, uuid.UUID(update["id"]))

    assert delete_response.status_code == 204
    assert remaining_update is None
