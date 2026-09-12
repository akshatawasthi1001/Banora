from __future__ import annotations

import uuid

import pytest

from app.db.base import Base
from app.models import Inquiry, InquiryStatus

from test_auth import TestingSessionLocal, client
from test_contractors import create_profile, register_user


@pytest.fixture(autouse=True)
def reset_db() -> None:
    bind = TestingSessionLocal.kw["bind"]
    Base.metadata.drop_all(bind=bind)
    Base.metadata.create_all(bind=bind)


def create_contractor(
    email: str = "contractor@example.com",
) -> tuple[dict[str, object], str]:
    profile, token = create_profile(email)
    return profile, token


def inquiry_payload(contractor_id: str, **overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "contractor_id": contractor_id,
        "subject": "Kitchen renovation inquiry",
        "message": "I would like to discuss a renovation project.",
    }
    payload.update(overrides)
    return payload


def create_inquiry_fixture(
    contractor_email: str = "contractor@example.com",
    client_email: str = "client@example.com",
    **overrides: object,
) -> tuple[dict[str, object], dict[str, object], str, str]:
    profile, contractor_token = create_contractor(contractor_email)
    _, client_token = register_user(client_email, "CLIENT")
    response = client.post(
        "/api/v1/inquiries",
        json=inquiry_payload(profile["id"], **overrides),
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert response.status_code == 201
    return profile, response.json(), client_token, contractor_token


def test_client_can_create_inquiry() -> None:
    profile, inquiry, _, _ = create_inquiry_fixture()

    assert inquiry["contractor_profile_id"] == profile["id"]
    assert inquiry["status"] == "NEW"
    assert "password_hash" not in inquiry


def test_unauthenticated_and_contractor_cannot_create_inquiry() -> None:
    profile, contractor_token = create_contractor()
    unauthenticated = client.post(
        "/api/v1/inquiries",
        json=inquiry_payload(profile["id"]),
    )
    contractor = client.post(
        "/api/v1/inquiries",
        json=inquiry_payload(profile["id"]),
        headers={"Authorization": f"Bearer {contractor_token}"},
    )

    assert unauthenticated.status_code == 401
    assert contractor.status_code == 403


def test_invalid_contractor_and_self_inquiry_are_rejected() -> None:
    _, client_token = register_user("client@example.com", "CLIENT")
    missing = client.post(
        "/api/v1/inquiries",
        json=inquiry_payload(str(uuid.uuid4())),
        headers={"Authorization": f"Bearer {client_token}"},
    )

    contractor_user_id, contractor_token = register_user(
        "self@example.com", "CONTRACTOR"
    )
    profile = client.post(
        "/api/v1/contractors/profile",
        json={
            "name": "Self Contractor",
            "city": "Austin",
            "state": "Texas",
            "country": "USA",
        },
        headers={"Authorization": f"Bearer {contractor_token}"},
    )
    self_attempt = client.post(
        "/api/v1/inquiries",
        json=inquiry_payload(profile.json()["id"]),
        headers={"Authorization": f"Bearer {contractor_token}"},
    )

    assert missing.status_code == 404
    assert self_attempt.status_code == 403
    assert contractor_user_id


def test_client_sees_only_own_inquiries() -> None:
    profile, first_inquiry, first_token, _ = create_inquiry_fixture()
    _, second_token = register_user("second@example.com", "CLIENT")
    second = client.post(
        "/api/v1/inquiries",
        json=inquiry_payload(profile["id"], subject="Second inquiry"),
        headers={"Authorization": f"Bearer {second_token}"},
    )

    first_list = client.get(
        "/api/v1/inquiries/me",
        headers={"Authorization": f"Bearer {first_token}"},
    )
    second_list = client.get(
        "/api/v1/inquiries/me",
        headers={"Authorization": f"Bearer {second_token}"},
    )

    assert second.status_code == 201
    assert first_list.json()["total"] == 1
    assert first_list.json()["items"][0]["id"] == first_inquiry["id"]
    assert second_list.json()["total"] == 1
    assert second_list.json()["items"][0]["subject"] == "Second inquiry"


def test_contractor_sees_only_received_inquiries() -> None:
    first_profile, _, _, first_token = create_inquiry_fixture()
    second_profile, _, _, second_token = create_inquiry_fixture(
        contractor_email="second-contractor@example.com",
        client_email="second-client@example.com",
    )

    first_list = client.get(
        "/api/v1/inquiries/received",
        headers={"Authorization": f"Bearer {first_token}"},
    )
    second_list = client.get(
        "/api/v1/inquiries/received",
        headers={"Authorization": f"Bearer {second_token}"},
    )

    assert first_list.json()["total"] == 1
    assert first_list.json()["items"][0]["contractor_profile_id"] == first_profile["id"]
    assert second_list.json()["total"] == 1
    assert second_list.json()["items"][0]["contractor_profile_id"] == second_profile["id"]


def test_client_and_receiving_contractor_can_get_inquiry() -> None:
    _, inquiry, client_token, contractor_token = create_inquiry_fixture()
    path = f"/api/v1/inquiries/{inquiry['id']}"

    client_response = client.get(path, headers={"Authorization": f"Bearer {client_token}"})
    contractor_response = client.get(
        path, headers={"Authorization": f"Bearer {contractor_token}"}
    )

    assert client_response.status_code == 200
    assert contractor_response.status_code == 200


def test_unauthorized_users_cannot_get_inquiry() -> None:
    _, inquiry, _, _ = create_inquiry_fixture()
    _, other_client_token = register_user("other@example.com", "CLIENT")
    _, other_contractor_token = create_contractor("other-contractor@example.com")
    path = f"/api/v1/inquiries/{inquiry['id']}"

    other_client = client.get(path, headers={"Authorization": f"Bearer {other_client_token}"})
    other_contractor = client.get(
        path, headers={"Authorization": f"Bearer {other_contractor_token}"}
    )

    assert other_client.status_code == 404
    assert other_contractor.status_code == 404


def test_contractor_can_progress_status_to_closed() -> None:
    _, inquiry, _, contractor_token = create_inquiry_fixture()
    path = f"/api/v1/inquiries/{inquiry['id']}/status"
    contacted = client.patch(
        path,
        json={"status": "CONTACTED"},
        headers={"Authorization": f"Bearer {contractor_token}"},
    )
    closed = client.patch(
        path,
        json={"status": "CLOSED"},
        headers={"Authorization": f"Bearer {contractor_token}"},
    )

    assert contacted.status_code == 200
    assert contacted.json()["status"] == "CONTACTED"
    assert closed.status_code == 200
    assert closed.json()["status"] == "CLOSED"


def test_invalid_status_transitions_are_rejected() -> None:
    _, inquiry, _, contractor_token = create_inquiry_fixture()
    path = f"/api/v1/inquiries/{inquiry['id']}/status"
    closed_from_new = client.patch(
        path,
        json={"status": "CLOSED"},
        headers={"Authorization": f"Bearer {contractor_token}"},
    )
    contacted = client.patch(
        path,
        json={"status": "CONTACTED"},
        headers={"Authorization": f"Bearer {contractor_token}"},
    )
    closed = client.patch(
        path,
        json={"status": "CLOSED"},
        headers={"Authorization": f"Bearer {contractor_token}"},
    )
    reopened = client.patch(
        path,
        json={"status": "CONTACTED"},
        headers={"Authorization": f"Bearer {contractor_token}"},
    )

    assert closed_from_new.status_code == 409
    assert contacted.status_code == 200
    assert closed.status_code == 200
    assert reopened.status_code == 409


def test_client_and_unrelated_contractor_cannot_update_status() -> None:
    _, inquiry, client_token, _ = create_inquiry_fixture()
    _, unrelated_token = create_contractor("unrelated@example.com")
    path = f"/api/v1/inquiries/{inquiry['id']}/status"
    client_response = client.patch(
        path,
        json={"status": "CONTACTED"},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    unrelated_response = client.patch(
        path,
        json={"status": "CONTACTED"},
        headers={"Authorization": f"Bearer {unrelated_token}"},
    )

    assert client_response.status_code == 403
    assert unrelated_response.status_code == 404


def test_pagination_and_newest_first() -> None:
    profile, _, first_token, _ = create_inquiry_fixture()
    for index in range(1, 4):
        response = client.post(
            "/api/v1/inquiries",
            json=inquiry_payload(profile["id"], subject=f"Inquiry {index}"),
            headers={"Authorization": f"Bearer {first_token}"},
        )
        assert response.status_code == 201

    response = client.get(
        "/api/v1/inquiries/me?page=2&page_size=2",
        headers={"Authorization": f"Bearer {first_token}"},
    )
    data = response.json()

    assert response.status_code == 200
    assert data["total"] == 4
    assert data["page"] == 2
    assert data["page_size"] == 2
    assert data["total_pages"] == 2
    assert len(data["items"]) == 2


def test_blank_subject_and_message_are_rejected() -> None:
    profile, _, client_token, _ = create_inquiry_fixture()
    subject_response = client.post(
        "/api/v1/inquiries",
        json=inquiry_payload(profile["id"], subject="   "),
        headers={"Authorization": f"Bearer {client_token}"},
    )
    message_response = client.post(
        "/api/v1/inquiries",
        json=inquiry_payload(profile["id"], message="   "),
        headers={"Authorization": f"Bearer {client_token}"},
    )

    assert subject_response.status_code == 422
    assert message_response.status_code == 422


def test_inquiry_response_does_not_expose_password_or_request_ownership_override() -> None:
    profile, inquiry, client_token, _ = create_inquiry_fixture()
    assert "password_hash" not in inquiry
    override = client.post(
        "/api/v1/inquiries",
        json=inquiry_payload(
            profile["id"],
            client_id=str(uuid.uuid4()),
            contractor_profile_id=str(uuid.uuid4()),
        ),
        headers={"Authorization": f"Bearer {client_token}"},
    )

    assert override.status_code == 422


def test_model_status_is_new() -> None:
    with TestingSessionLocal() as db:
        assert db.query(Inquiry).count() == 0
        assert InquiryStatus.NEW.value == "NEW"
