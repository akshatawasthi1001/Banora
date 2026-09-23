"""E2E API verification against the running Banora stack.

Exercises the full client and contractor flows plus authorization (IDOR),
validation, and edge-case behavior. Uses uniquely-suffixed test accounts so
existing database data is never touched.

Usage: python scripts/e2e_api_test.py
"""

from __future__ import annotations

import sys
import time
import uuid

import httpx

BASE_URL = "http://localhost:8000/api/v1"

PASS = 0
FAIL = 0
FAILURES: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  PASS {name}")
    else:
        FAIL += 1
        FAILURES.append(f"{name} {detail}")
        print(f"  FAIL {name} {detail}")


def expect_status(name: str, response: httpx.Response, expected: int) -> None:
    check(name, response.status_code == expected, f"(got {response.status_code}: {response.text[:120]})")


def login_with_retry(http: httpx.Client, email: str, password: str) -> httpx.Response:
    """Login with one retry in case the per-IP auth rate limit was hit by a
    previous E2E run within the same rate-limit window."""
    response = http.post("/auth/login", json={"email": email, "password": password})
    if response.status_code == 429:
        print("  (rate limited; waiting for window reset and retrying once)")
        time.sleep(310)
        response = http.post("/auth/login", json={"email": email, "password": password})
    return response


def main() -> int:
    run = uuid.uuid4().hex[:8]
    client = httpx.Client(base_url=BASE_URL, timeout=30)

    print("== Health ==")
    health = client.get(f"{BASE_URL.replace('/api/v1', '')}/health")
    expect_status("health endpoint", health, 200)

    print("== Client flow ==")
    client_email = f"e2e-client-{run}@example.com"
    r = client.post("/auth/register", json={"email": client_email, "password": "e2epass123", "role": "CLIENT"})
    expect_status("client registration", r, 201)

    r = client.post("/auth/register", json={"email": client_email, "password": "e2epass123", "role": "CLIENT"})
    expect_status("duplicate registration -> 409", r, 409)

    r = login_with_retry(client, client_email, "wrong-password")
    expect_status("wrong password -> 401", r, 401)

    r = client.post("/auth/login", json={"email": f"nobody-{run}@example.com", "password": "e2epass123"})
    expect_status("unknown email login -> 401", r, 401)

    r = login_with_retry(client, client_email, "e2epass123")
    expect_status("client login", r, 200)
    client_token = r.json()["access_token"]
    client_auth = {"Authorization": f"Bearer {client_token}"}

    r = client.get("/auth/me", headers=client_auth)
    expect_status("client /auth/me", r, 200)
    client_id = r.json()["id"]

    r = client.get("/auth/me")
    expect_status("unauthenticated /auth/me -> 401", r, 401)

    r = client.get("/auth/me", headers={"Authorization": "Bearer garbage.token.here"})
    expect_status("invalid token -> 401", r, 401)

    r = client.get("/projects/me", headers=client_auth)
    expect_status("client blocked from contractor projects -> 403", r, 403)

    r = client.get("/contractors/me", headers=client_auth)
    expect_status("client blocked from /contractors/me -> 403", r, 403)

    r = client.get("/inquiries/received", headers=client_auth)
    expect_status("client blocked from received inquiries -> 403", r, 403)

    print("== Contractor flow ==")
    contractor_email = f"e2e-contractor-{run}@example.com"
    r = client.post("/auth/register", json={"email": contractor_email, "password": "e2epass123", "role": "CONTRACTOR"})
    expect_status("contractor registration", r, 201)

    r = login_with_retry(client, contractor_email, "e2epass123")
    expect_status("contractor login", r, 200)
    contractor_token = r.json()["access_token"]
    contractor_auth = {"Authorization": f"Bearer {contractor_token}"}

    # Reuse the same token instead of logging in twice; the login rate limit
    # is per IP, so repeated runs of this script must stay under the budget.
    contractor_auth2 = contractor_auth

    r = client.post("/inquiries", headers=contractor_auth, json={
        "contractor_id": str(uuid.uuid4()), "subject": "s", "message": "m"})
    expect_status("contractor blocked from creating inquiries -> 403", r, 403)

    r = client.post("/contractors/{0}/reviews".format(run), headers=contractor_auth, json={"rating": 5})
    expect_status("contractor blocked from reviewing -> 403", r, 403)

    r = client.post("/contractors/profile", headers=contractor_auth, json={
        "name": f"E2E Contractor {run}", "city": "Bengaluru", "state": "Karnataka", "country": "India",
        "bio": "E2E verification contractor", "experience_years": 7})
    expect_status("contractor profile create", r, 201)
    contractor_profile_id = r.json()["id"]

    r = client.post("/contractors/profile", headers=contractor_auth, json={
        "name": "Dup", "city": "X", "state": "Y", "country": "Z"})
    expect_status("duplicate profile -> 409", r, 409)

    r = client.patch("/contractors/me", headers=contractor_auth, json={"bio": "Updated bio", "experience_years": 9})
    expect_status("contractor profile update", r, 200)
    check("profile update persisted", r.json()["bio"] == "Updated bio" and r.json()["experience_years"] == 9)

    r = client.post("/projects", headers=contractor_auth, json={
        "title": f"E2E Project {run}", "description": "E2E test project",
        "project_type": "RESIDENTIAL", "city": "Bengaluru", "state": "Karnataka", "country": "India",
        "budget_min": 1000000, "budget_max": 2000000, "floors": 2})
    expect_status("project create", r, 201)
    project_id = r.json()["id"]

    r = client.post("/projects", headers=contractor_auth, json={
        "title": "Bad range", "project_type": "RESIDENTIAL",
        "city": "Bengaluru", "state": "Karnataka", "country": "India", "budget_min": 500, "budget_max": 100})
    expect_status("budget_max < budget_min -> 422", r, 422)

    r = client.post("/projects", headers=contractor_auth, json={
        "title": "x" * 250, "project_type": "RESIDENTIAL",
        "city": "Bengaluru", "state": "Karnataka", "country": "India"})
    expect_status("oversized title -> 422", r, 422)

    r = client.patch(f"/projects/me/{project_id}", headers=contractor_auth, json={"title": "E2E Project renamed"})
    expect_status("project update", r, 200)

    r = client.post(f"/projects/me/{project_id}/stages", headers=contractor_auth, json={
        "name": "Foundation", "stage_order": 1})
    expect_status("stage create", r, 201)
    stage_id = r.json()["id"]

    r = client.post(f"/projects/me/{project_id}/stages", headers=contractor_auth, json={
        "name": "Dup order", "stage_order": 1})
    expect_status("duplicate stage order -> 409", r, 409)

    r = client.patch(f"/projects/me/{project_id}/stages/{stage_id}", headers=contractor_auth, json={
        "status": "IN_PROGRESS"})
    expect_status("stage status update", r, 200)

    r = client.post(f"/projects/me/{project_id}/stages/{stage_id}/updates", headers=contractor_auth, json={
        "title": "Excavation done", "progress_percentage": 40, "update_date": "2026-09-20"})
    expect_status("progress update create", r, 201)
    update_id = r.json()["id"]

    r = client.post(f"/projects/me/{project_id}/stages/{stage_id}/updates", headers=contractor_auth, json={
        "title": "Bad pct", "progress_percentage": 140, "update_date": "2026-09-20"})
    expect_status("progress > 100 -> 422", r, 422)

    r = client.patch(
        f"/projects/me/{project_id}/stages/{stage_id}/updates/{update_id}",
        headers=contractor_auth, json={"progress_percentage": 65})
    expect_status("progress update edit", r, 200)

    r = client.post(
        f"/projects/me/{project_id}/stages/{stage_id}/updates/{update_id}/media",
        headers=contractor_auth,
        json={"media_type": "IMAGE", "url": "https://example.com/site-photo.jpg", "caption": "Site photo"})
    expect_status("media create", r, 201)
    media_id = r.json()["id"]

    r = client.post(
        f"/projects/me/{project_id}/stages/{stage_id}/updates/{update_id}/media",
        headers=contractor_auth,
        json={"media_type": "IMAGE", "url": "javascript:alert(1)"})
    expect_status("non-http media URL -> 422", r, 422)

    print("== Public discovery ==")
    r = client.get("/contractors", params={"search": f"E2E Contractor {run}"})
    expect_status("contractor list", r, 200)
    check("new contractor in list", any(item["id"] == contractor_profile_id for item in r.json()["items"]))

    r = client.get("/contractors", params={"city": "Bengaluru", "experience_years_min": 5})
    expect_status("filtered contractor list", r, 200)

    r = client.get(f"/contractors/{contractor_profile_id}")
    expect_status("public contractor profile", r, 200)

    r = client.get(f"/projects/{project_id}")
    expect_status("public project", r, 200)

    r = client.get(f"/projects/{project_id}/journey")
    expect_status("public journey", r, 200)
    check("journey has stage + update",
          len(r.json()["stages"]) == 1 and len(r.json()["stages"][0]["progress_updates"]) == 1)

    r = client.get(f"/projects/{uuid.uuid4()}")
    expect_status("invalid project id -> 404", r, 404)

    r = client.get(f"/contractors/{uuid.uuid4()}")
    expect_status("invalid contractor id -> 404", r, 404)

    print("== Inquiry flow ==")
    r = client.post("/inquiries", headers=client_auth, json={
        "contractor_id": contractor_profile_id, "subject": "Kitchen remodel",
        "message": "Interested in a full kitchen remodel next quarter."})
    expect_status("client sends inquiry", r, 201)
    inquiry_id = r.json()["id"]
    check("inquiry starts NEW", r.json()["status"] == "NEW")

    r = client.post("/inquiries", headers=client_auth, json={
        "contractor_id": contractor_profile_id, "subject": "", "message": "x"})
    expect_status("blank subject -> 422", r, 422)

    r = client.get("/inquiries/me", headers=client_auth)
    expect_status("client inquiries list", r, 200)
    check("inquiry in client list", any(item["id"] == inquiry_id for item in r.json()["items"]))

    r = client.get("/inquiries/received", headers=contractor_auth2)
    expect_status("contractor received list", r, 200)
    check("inquiry in received list", any(item["id"] == inquiry_id for item in r.json()["items"]))

    r = client.get(f"/inquiries/{inquiry_id}", headers=contractor_auth)
    expect_status("contractor can view received inquiry", r, 200)

    r = client.patch(f"/inquiries/{inquiry_id}/status", headers=contractor_auth, json={"status": "CLOSED"})
    expect_status("invalid transition NEW->CLOSED -> 409", r, 409)

    r = client.patch(f"/inquiries/{inquiry_id}/status", headers=contractor_auth, json={"status": "CONTACTED"})
    expect_status("transition NEW->CONTACTED", r, 200)

    r = client.patch(f"/inquiries/{inquiry_id}/status", headers=client_auth, json={"status": "CLOSED"})
    expect_status("client cannot update status -> 403", r, 403)

    r = client.get(f"/inquiries/{inquiry_id}", headers=client_auth)
    check("client sees updated status", r.status_code == 200 and r.json()["status"] == "CONTACTED")

    r = client.get(f"/inquiries/{inquiry_id}", headers={"Authorization": f"Bearer {contractor_token}"})
    expect_status("recipient contractor can view inquiry", r, 200)

    print("== IDOR checks ==")
    # Second contractor tries to touch the first contractor's project.
    other_email = f"e2e-other-{run}@example.com"
    client.post("/auth/register", json={"email": other_email, "password": "e2epass123", "role": "CONTRACTOR"})
    r = login_with_retry(client, other_email, "e2epass123")
    other_auth = {"Authorization": f"Bearer {r.json()['access_token']}"}
    client.post("/contractors/profile", headers=other_auth, json={
        "name": "Other Contractor", "city": "Mumbai", "state": "Maharashtra", "country": "India"})

    r = client.get(f"/projects/me/{project_id}", headers=other_auth)
    expect_status("other contractor read of project -> 404", r, 404)

    r = client.patch(f"/projects/me/{project_id}", headers=other_auth, json={"title": "hijacked"})
    expect_status("other contractor modify of project -> 404", r, 404)

    r = client.delete(f"/projects/me/{project_id}", headers=other_auth)
    expect_status("other contractor delete of project -> 404", r, 404)

    r = client.patch(
        f"/projects/me/{project_id}/stages/{stage_id}", headers=other_auth, json={"status": "COMPLETED"})
    expect_status("other contractor modify of stage -> 404", r, 404)

    r = client.patch(f"/inquiries/{inquiry_id}/status", headers=other_auth, json={"status": "CONTACTED"})
    expect_status("other contractor update of inquiry -> 404", r, 404)

    r = client.patch(f"/contractors/me", headers={"Authorization": f"Bearer {contractor_token}"},
                     json={"experience_years": 99})
    expect_status("profile update scoped to own profile", r, 200)

    print("== Review flow ==")
    r = client.post(f"/contractors/{contractor_profile_id}/reviews", headers=client_auth, json={
        "rating": 5, "comment": "Outstanding work and communication."})
    expect_status("client creates review", r, 201)
    review_id = r.json()["id"]

    r = client.post(f"/contractors/{contractor_profile_id}/reviews", headers=client_auth, json={"rating": 4})
    expect_status("duplicate review -> 409", r, 409)

    r = client.post(f"/contractors/{contractor_profile_id}/reviews", headers=client_auth, json={"rating": 9})
    expect_status("invalid rating -> 422", r, 422)

    r = client.post(f"/contractors/{contractor_profile_id}/reviews", headers=contractor_auth, json={"rating": 5})
    expect_status("contractor cannot review -> 403", r, 403)

    # A CONTRACTOR is rejected by the role gate (403) before ownership is
    # even evaluated; a CLIENT who owns nothing would get 404. Both deny.
    r = client.patch(f"/contractors/{contractor_profile_id}/reviews/{review_id}", headers=other_auth,
                     json={"rating": 1})
    check("other contractor edit review denied", r.status_code in (403, 404), f"(got {r.status_code})")

    r = client.patch(f"/contractors/{contractor_profile_id}/reviews/{review_id}", headers=client_auth,
                     json={"rating": 4, "comment": "Edited comment."})
    expect_status("owner edits review", r, 200)

    r = client.get(f"/contractors/{contractor_profile_id}/reviews/{review_id}", headers=contractor_auth)
    expect_status("public read of review", r, 200)

    r = client.get(f"/contractors/{contractor_profile_id}/rating")
    expect_status("rating summary", r, 200)
    check("rating summary correct", r.json()["review_count"] == 1 and r.json()["average_rating"] == 4.0)

    r = client.delete(f"/contractors/{contractor_profile_id}/reviews/{review_id}", headers=other_auth)
    check("other contractor delete review denied", r.status_code in (403, 404), f"(got {r.status_code})")

    r = client.delete(f"/contractors/{contractor_profile_id}/reviews/{review_id}", headers=client_auth)
    expect_status("owner deletes review", r, 204)

    print("== Cleanup (removes only E2E-created data) ==")
    r = client.delete(
        f"/projects/me/{project_id}/stages/{stage_id}/updates/{update_id}/media/{media_id}",
        headers=contractor_auth)
    expect_status("media delete", r, 204)

    r = client.delete(f"/projects/me/{project_id}/stages/{stage_id}/updates/{update_id}", headers=contractor_auth)
    expect_status("progress update delete", r, 204)

    r = client.delete(f"/projects/me/{project_id}/stages/{stage_id}", headers=contractor_auth)
    expect_status("stage delete", r, 204)

    r = client.delete(f"/projects/me/{project_id}", headers=contractor_auth)
    expect_status("project delete", r, 204)

    r = client.get(f"/projects/{project_id}")
    expect_status("deleted project gone -> 404", r, 404)

    r = client.get("/projects/me", headers=contractor_auth)
    check("no E2E projects remain", all(item["id"] != project_id for item in r.json()["items"]))

    print("== Rate limiting ==")
    login_responses = [
        client.post("/auth/login", json={"email": f"rl-{run}-{i}@example.com", "password": "badpass1"})
        for i in range(12)
    ]
    codes = [resp.status_code for resp in login_responses]
    check("rate limit triggers 429 after burst", 429 in codes, f"(codes: {codes})")

    client.close()
    print(f"\n===== RESULTS: {PASS} passed, {FAIL} failed =====")
    if FAILURES:
        print("Failures:")
        for failure in FAILURES:
            print(f"  - {failure}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
