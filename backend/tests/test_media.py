from __future__ import annotations

import uuid

import pytest

from app.db.base import Base
from app.models import MediaAsset

from test_auth import TestingSessionLocal, client
from test_construction import create_update
from test_contractors import create_profile, register_user
from test_projects import create_project


@pytest.fixture(autouse=True)
def reset_db() -> None:
    bind = TestingSessionLocal.kw["bind"]
    Base.metadata.drop_all(bind=bind)
    Base.metadata.create_all(bind=bind)


def media_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "media_type": "IMAGE",
        "url": "https://cdn.example.com/project.jpg",
        "thumbnail_url": "https://cdn.example.com/thumb.jpg",
        "alt_text": "Project exterior",
        "caption": "Completed exterior view",
        "display_order": 0,
    }
    payload.update(overrides)
    return payload


def create_project_media(
    email: str = "contractor@example.com",
    **overrides: object,
) -> tuple[dict[str, object], dict[str, object], str]:
    project, token = create_project(email)
    response = client.post(
        f"/api/v1/projects/me/{project['id']}/media",
        json=media_payload(**overrides),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    return project, response.json(), token


def create_update_media(
    email: str = "contractor@example.com",
    **overrides: object,
) -> tuple[dict[str, object], dict[str, object], dict[str, object], dict[str, object], str]:
    project, stage, update, token = create_update(email)
    response = client.post(
        f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}/updates/{update['id']}/media",
        json=media_payload(**overrides),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    return project, stage, update, response.json(), token


def test_project_media_public_list_pagination_and_ordering() -> None:
    project, _, token = create_project_media(display_order=2)
    for order in (1, 3):
        response = client.post(
            f"/api/v1/projects/me/{project['id']}/media",
            json=media_payload(display_order=order, url=f"https://cdn.example.com/{order}.jpg"),
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201

    response = client.get(f"/api/v1/projects/{project['id']}/media?page=1&page_size=2")
    data = response.json()

    assert response.status_code == 200
    assert data["total"] == 3
    assert data["total_pages"] == 2
    assert [item["display_order"] for item in data["items"]] == [1, 2]
    assert "project_id" not in response.text
    assert "progress_update_id" not in response.text


def test_contractor_can_create_list_update_delete_project_media() -> None:
    project, media, token = create_project_media()
    list_response = client.get(
        f"/api/v1/projects/me/{project['id']}/media",
        headers={"Authorization": f"Bearer {token}"},
    )
    update_response = client.patch(
        f"/api/v1/projects/me/{project['id']}/media/{media['id']}",
        json={"caption": "Updated caption", "display_order": 3},
        headers={"Authorization": f"Bearer {token}"},
    )
    delete_response = client.delete(
        f"/api/v1/projects/me/{project['id']}/media/{media['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert list_response.status_code == 200
    assert list_response.json()["total"] == 1
    assert update_response.status_code == 200
    assert update_response.json()["caption"] == "Updated caption"
    assert delete_response.status_code == 204


def test_project_media_type_filter_and_data_integrity() -> None:
    project, _, token = create_project_media(media_type="VIDEO")
    response = client.get(
        f"/api/v1/projects/{project['id']}/media?media_type=VIDEO"
    )

    with TestingSessionLocal() as db:
        media = db.query(MediaAsset).one()

    assert response.status_code == 200
    assert response.json()["items"][0]["media_type"] == "VIDEO"
    assert media.project_id == uuid.UUID(project["id"])
    assert media.progress_update_id is None
    assert token


def test_progress_media_public_and_contractor_crud() -> None:
    project, stage, update, media, token = create_update_media()
    public_response = client.get(
        f"/api/v1/projects/{project['id']}/stages/{stage['id']}/updates/{update['id']}/media"
    )
    list_response = client.get(
        f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}/updates/{update['id']}/media",
        headers={"Authorization": f"Bearer {token}"},
    )
    update_response = client.patch(
        f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}/updates/{update['id']}/media/{media['id']}",
        json={"media_type": "VIDEO"},
        headers={"Authorization": f"Bearer {token}"},
    )
    delete_response = client.delete(
        f"/api/v1/projects/me/{project['id']}/stages/{stage['id']}/updates/{update['id']}/media/{media['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )

    with TestingSessionLocal() as db:
        stored = db.query(MediaAsset).one_or_none()

    assert public_response.status_code == 200
    assert list_response.status_code == 200
    assert update_response.status_code == 200
    assert update_response.json()["media_type"] == "VIDEO"
    assert delete_response.status_code == 204
    assert stored is None


def test_progress_media_data_integrity() -> None:
    project, stage, update, media, _ = create_update_media()

    with TestingSessionLocal() as db:
        stored = db.get(MediaAsset, uuid.UUID(media["id"]))

    assert stored is not None
    assert stored.project_id is None
    assert stored.progress_update_id == uuid.UUID(update["id"])
    assert project["id"] and stage["id"]


def test_public_progress_media_rejects_wrong_relationship() -> None:
    project, stage, update, _, _ = create_update_media()
    wrong_project = client.get(
        f"/api/v1/projects/{uuid.uuid4()}/stages/{stage['id']}/updates/{update['id']}/media"
    )
    wrong_stage = client.get(
        f"/api/v1/projects/{project['id']}/stages/{uuid.uuid4()}/updates/{update['id']}/media"
    )
    wrong_update = client.get(
        f"/api/v1/projects/{project['id']}/stages/{stage['id']}/updates/{uuid.uuid4()}/media"
    )

    assert wrong_project.status_code == 404
    assert wrong_stage.status_code == 404
    assert wrong_update.status_code == 404


def test_media_authorization_and_ownership_isolation() -> None:
    project, media, _ = create_project_media("owner@example.com")
    _, other_token = create_profile("other@example.com")
    _, client_token = register_user("client@example.com", "CLIENT")
    project_path = f"/api/v1/projects/me/{project['id']}/media"
    media_path = f"{project_path}/{media['id']}"

    other_create = client.post(
        project_path,
        json=media_payload(),
        headers={"Authorization": f"Bearer {other_token}"},
    )
    other_update = client.patch(
        media_path,
        json={"caption": "Tampered"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    other_delete = client.delete(
        media_path,
        headers={"Authorization": f"Bearer {other_token}"},
    )
    client_create = client.post(
        project_path,
        json=media_payload(),
        headers={"Authorization": f"Bearer {client_token}"},
    )
    unauthenticated = client.post(project_path, json=media_payload())

    assert other_create.status_code == 404
    assert other_update.status_code == 404
    assert other_delete.status_code == 404
    assert client_create.status_code == 403
    assert unauthenticated.status_code == 401


def test_invalid_media_fields_rejected() -> None:
    project, _, token = create_project_media()
    endpoint = f"/api/v1/projects/me/{project['id']}/media"
    invalid_values = [
        {"media_type": "AUDIO"},
        {"url": "not-a-url"},
        {"thumbnail_url": "not-a-url"},
        {"display_order": -1},
    ]

    for invalid_value in invalid_values:
        response = client.post(
            endpoint,
            json=media_payload(**invalid_value),
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422


def test_public_media_unknown_project_returns_404() -> None:
    response = client.get(f"/api/v1/projects/{uuid.uuid4()}/media")

    assert response.status_code == 404
