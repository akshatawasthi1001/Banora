from __future__ import annotations

from datetime import datetime, timedelta, timezone
import uuid

import pytest

from app.db.base import Base
from app.models import Review

from test_auth import TestingSessionLocal, client
from test_contractors import create_profile, register_user


@pytest.fixture(autouse=True)
def reset_db() -> None:
    bind = TestingSessionLocal.kw["bind"]
    Base.metadata.drop_all(bind=bind)
    Base.metadata.create_all(bind=bind)


def review_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "rating": 5,
        "comment": "Excellent construction quality and professional work.",
    }
    payload.update(overrides)
    return payload


def create_review(
    contractor_email: str = "contractor@example.com",
    client_email: str = "client@example.com",
    **overrides: object,
) -> tuple[dict[str, object], str, str]:
    contractor, _ = create_profile(contractor_email)
    _, client_token = register_user(client_email, "CLIENT")
    response = client.post(
        f"/api/v1/contractors/{contractor['id']}/reviews",
        json=review_payload(**overrides),
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert response.status_code == 201
    return contractor, response.json(), client_token


def create_review_for_contractor(
    contractor: dict[str, object],
    client_email: str,
    **overrides: object,
) -> dict[str, object]:
    _, client_token = register_user(client_email, "CLIENT")
    response = client.post(
        f"/api/v1/contractors/{contractor['id']}/reviews",
        json=review_payload(**overrides),
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert response.status_code == 201
    return response.json()


def test_client_can_create_update_and_delete_review() -> None:
    contractor, review, client_token = create_review()
    path = f"/api/v1/contractors/{contractor['id']}/reviews/{review['id']}"

    update_response = client.patch(
        path,
        json={"rating": 4, "comment": "Updated review"},
        headers={"Authorization": f"Bearer {client_token}"},
    )
    get_response = client.get(path)
    delete_response = client.delete(
        path,
        headers={"Authorization": f"Bearer {client_token}"},
    )

    assert update_response.status_code == 200
    assert update_response.json()["rating"] == 4
    assert update_response.json()["comment"] == "Updated review"
    assert get_response.status_code == 200
    assert delete_response.status_code == 204
    assert client.get(path).status_code == 404


def test_duplicate_review_and_self_review_are_rejected() -> None:
    contractor, _, client_token = create_review()
    duplicate = client.post(
        f"/api/v1/contractors/{contractor['id']}/reviews",
        json=review_payload(rating=3),
        headers={"Authorization": f"Bearer {client_token}"},
    )
    contractor_user_id, contractor_token = register_user(
        "self@example.com", "CONTRACTOR"
    )
    self_profile = client.post(
        "/api/v1/contractors/profile",
        json={
            "name": "Self Contractor",
            "city": "Austin",
            "state": "Texas",
            "country": "USA",
        },
        headers={"Authorization": f"Bearer {contractor_token}"},
    )
    self_review = client.post(
        f"/api/v1/contractors/{self_profile.json()['id']}/reviews",
        json=review_payload(),
        headers={"Authorization": f"Bearer {contractor_token}"},
    )

    assert duplicate.status_code == 409
    assert self_review.status_code == 403
    assert contractor_user_id


def test_public_reviews_pagination_and_ordering() -> None:
    contractor, first_review, first_token = create_review()
    second_review = create_review_for_contractor(
        contractor,
        "second@example.com",
        rating=4,
    )
    third_review = create_review_for_contractor(
        contractor,
        "third@example.com",
        rating=3,
    )

    with TestingSessionLocal() as db:
        db.get(Review, uuid.UUID(first_review["id"])).created_at = datetime.now(
            timezone.utc
        ) - timedelta(days=3)
        db.get(Review, uuid.UUID(second_review["id"])).created_at = datetime.now(
            timezone.utc
        ) - timedelta(days=2)
        db.get(Review, uuid.UUID(third_review["id"])).created_at = datetime.now(
            timezone.utc
        ) - timedelta(days=1)
        db.commit()

    response = client.get(
        f"/api/v1/contractors/{contractor['id']}/reviews?page=1&page_size=2"
    )
    data = response.json()

    assert response.status_code == 200
    assert data["total"] == 3
    assert data["total_pages"] == 2
    assert len(data["items"]) == 2
    assert [item["id"] for item in data["items"]] == [
        third_review["id"],
        second_review["id"],
    ]
    assert "client_id" not in response.text
    assert "password_hash" not in response.text
    assert first_token


def test_unknown_contractor_and_wrong_contractor_review_return_404() -> None:
    contractor, review, _ = create_review()
    other_contractor, _ = create_profile("other@example.com")

    unknown = client.get(f"/api/v1/contractors/{uuid.uuid4()}/reviews")
    wrong_list = client.get(
        f"/api/v1/contractors/{other_contractor['id']}/reviews/{review['id']}"
    )
    detail = client.get(
        f"/api/v1/contractors/{contractor['id']}/reviews/{review['id']}"
    )

    assert unknown.status_code == 404
    assert wrong_list.status_code == 404
    assert detail.status_code == 200


def test_rating_summary_and_distribution() -> None:
    contractor, _, _ = create_review(rating=5)
    for index, rating in enumerate((5, 4, 3, 1), start=1):
        create_review_for_contractor(
            contractor,
            f"client{index}@example.com",
            rating=rating,
        )

    response = client.get(f"/api/v1/contractors/{contractor['id']}/rating")
    data = response.json()

    assert response.status_code == 200
    assert data["review_count"] == 5
    assert data["average_rating"] == 3.6
    assert data["rating_distribution"] == {
        "5": 2,
        "4": 1,
        "3": 1,
        "2": 0,
        "1": 1,
    }


def test_empty_rating_summary() -> None:
    contractor, _ = create_profile()

    response = client.get(f"/api/v1/contractors/{contractor['id']}/rating")

    assert response.status_code == 200
    assert response.json() == {
        "contractor_id": contractor["id"],
        "average_rating": 0,
        "review_count": 0,
        "rating_distribution": {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0},
    }


def test_contractor_can_view_but_not_modify_reviews() -> None:
    contractor, review, _ = create_review()
    _, contractor_token = register_user("viewer@example.com", "CONTRACTOR")
    profile_response = client.post(
        "/api/v1/contractors/profile",
        json={
            "name": "Viewer Contractor",
            "city": "Austin",
            "state": "Texas",
            "country": "USA",
        },
        headers={"Authorization": f"Bearer {contractor_token}"},
    )
    path = f"/api/v1/contractors/{contractor['id']}/reviews/{review['id']}"
    update_response = client.patch(
        path,
        json={"rating": 1},
        headers={"Authorization": f"Bearer {contractor_token}"},
    )
    delete_response = client.delete(
        path,
        headers={"Authorization": f"Bearer {contractor_token}"},
    )
    public_response = client.get(
        f"/api/v1/contractors/{contractor['id']}/reviews"
    )
    rating_response = client.get(
        f"/api/v1/contractors/{contractor['id']}/rating"
    )

    assert profile_response.status_code == 201
    assert update_response.status_code == 403
    assert delete_response.status_code == 403
    assert public_response.status_code == 200
    assert rating_response.status_code == 200


def test_unauthenticated_review_writes_are_rejected() -> None:
    contractor, review, _ = create_review()
    path = f"/api/v1/contractors/{contractor['id']}/reviews/{review['id']}"

    create_response = client.post(
        f"/api/v1/contractors/{contractor['id']}/reviews",
        json=review_payload(),
    )
    update_response = client.patch(path, json={"rating": 2})
    delete_response = client.delete(path)
    listing_response = client.get(
        f"/api/v1/contractors/{contractor['id']}/reviews"
    )
    rating_response = client.get(
        f"/api/v1/contractors/{contractor['id']}/rating"
    )

    assert create_response.status_code == 401
    assert update_response.status_code == 401
    assert delete_response.status_code == 401
    assert listing_response.status_code == 200
    assert rating_response.status_code == 200


def test_client_ownership_and_request_ids_cannot_be_overridden() -> None:
    contractor, review, _ = create_review()
    _, other_client_token = register_user("other-client@example.com", "CLIENT")
    path = f"/api/v1/contractors/{contractor['id']}/reviews/{review['id']}"
    other_update = client.patch(
        path,
        json={"rating": 1},
        headers={"Authorization": f"Bearer {other_client_token}"},
    )
    other_delete = client.delete(
        path,
        headers={"Authorization": f"Bearer {other_client_token}"},
    )
    invalid_create = client.post(
        f"/api/v1/contractors/{contractor['id']}/reviews",
        json=review_payload(client_id=str(uuid.uuid4())),
        headers={"Authorization": f"Bearer {other_client_token}"},
    )
    invalid_update = client.patch(
        path,
        json={"contractor_profile_id": str(uuid.uuid4())},
        headers={"Authorization": f"Bearer {other_client_token}"},
    )

    assert other_update.status_code == 404
    assert other_delete.status_code == 404
    assert invalid_create.status_code == 422
    assert invalid_update.status_code == 422


def test_review_validation_rejects_bad_rating_and_comment() -> None:
    contractor, _, client_token = create_review()
    endpoint = f"/api/v1/contractors/{contractor['id']}/reviews"
    for rating in (0, 6):
        response = client.post(
            endpoint,
            json=review_payload(rating=rating),
            headers={"Authorization": f"Bearer {client_token}"},
        )
        assert response.status_code == 422

    oversized = client.post(
        endpoint,
        json=review_payload(comment="x" * 5001),
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert oversized.status_code == 422
