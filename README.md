# Banora

Banora is a professional contractor discovery and construction portfolio platform. Clients discover contractors, explore real project portfolios with photo/video galleries, follow the full construction journey stage by stage, and contact contractors directly. Contractors manage a public profile, publish projects, document progress with stages, updates, and media, and track client inquiries through a clear status flow.

## Architecture

```
banora/
- backend/               FastAPI application (Python 3.13, SQLAlchemy 2, Alembic)
    - app/
        - api/v1/        Versioned REST endpoints (auth, contractors, projects,
                         construction, reviews, media, inquiries)
        - core/          Security (JWT + Argon2), dependencies, rate limiting
        - db/            Engine, session, declarative base
        - models/        SQLAlchemy ORM models
        - schemas/       Pydantic request/response schemas
        - services/      Business logic and ownership checks
        - config.py      Pydantic settings (env-driven)
        - main.py        FastAPI app, CORS, /health
    - alembic/           Migration environment and versions (0001-0007)
    - tests/             Pytest suite (TestClient + in-memory SQLite)
- frontend/              Next.js App Router application (TypeScript, Tailwind)
    - app/               Routes (public + role-based dashboards)
    - components/        Shared UI components
    - lib/               API wrappers, auth context, types
- docker-compose.yml     postgres + backend + frontend services
- scripts/e2e_api_test.py  End-to-end API verification script
```

## Tech stack

- **Backend:** FastAPI, SQLAlchemy 2, Alembic, PostgreSQL (psycopg 3), PyJWT, pwdlib (Argon2), Pydantic v2
- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Infrastructure:** Docker Compose, PostgreSQL 16

## Prerequisites

- Python 3.13+ (or Docker)
- Node.js 20+ with npm (or Docker)
- PostgreSQL 16 (local install or the provided Docker service)

## Environment variables

Copy the examples and fill in real values. Never commit real `.env` files.

| File | Purpose |
| --- | --- |
| `.env.example` (root) | Variables for `docker compose` (DB, JWT secret, CORS, rate limits) |
| `backend/.env.example` | Variables for running the backend outside Docker |
| `frontend/.env.example` | `NEXT_PUBLIC_API_URL` for the frontend |

Key variables:

- `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL credentials (password is required; compose refuses to start without it)
- `JWT_SECRET_KEY` - **required in production**; generate with `python -c "import secrets; print(secrets.token_urlsafe(64))"`
- `FRONTEND_URL` - browser origin allowed by CORS in development
- `CORS_ALLOW_ORIGINS` - comma-separated origin list; overrides `FRONTEND_URL` when set (production)
- `AUTH_RATE_LIMIT_ATTEMPTS`, `AUTH_RATE_LIMIT_WINDOW_SECONDS` - login/register rate limiting per IP
- `NEXT_PUBLIC_API_URL` - base URL the frontend calls, e.g. `http://localhost:8000/api/v1`

## Local setup (without Docker)

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # then set DB_PASSWORD and JWT_SECRET_KEY
alembic upgrade head
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. Health check: `http://localhost:8000/health`.

### Frontend

In a second terminal:

```powershell
cd frontend
npm install
copy .env.example .env.local   # defaults point at http://localhost:8000/api/v1
npm run dev
```

The web app runs at `http://localhost:3000`.

## Database setup and migrations

Migrations live in `backend/alembic/versions` and run in order `0001_create_users` to `0007_create_inquiries`. A fresh database is fully initialized by `alembic upgrade head`; never reset an existing database or delete migration files.

```powershell
cd backend
alembic upgrade head
alembic revision --autogenerate -m "..."   # new migration after model changes
```

## Run with Docker

From the repository root:

```powershell
Copy-Item .env.example .env
# Set DB_PASSWORD and JWT_SECRET_KEY in .env before starting.
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000` (health: `http://localhost:8000/health`)
- Stop with `docker compose down` (the `postgres_data` volume preserves your data)

For production deployment, set `CORS_ALLOW_ORIGINS` to your real frontend origin(s) and a strong `JWT_SECRET_KEY`, and remove the `--reload`/`npm run dev` overrides in `docker-compose.yml` so the prebuilt images (`uvicorn` without reload, `npm run start`) serve traffic.

## Important routes

### Backend API (`/api/v1`, interactive docs at `/docs`)

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `GET /contractors`, `GET /contractors/{id}`, `GET /contractors/{id}/reviews`, `GET /contractors/{id}/rating` (public)
- `POST /contractors/profile`, `GET|PATCH /contractors/me` (contractor only)
- `GET /projects`, `GET /projects/{id}`, `GET /projects/{id}/journey`, `GET /projects/{id}/media` (public)
- `POST /projects`, `GET /projects/me`, `PATCH|DELETE /projects/me/{id}` (contractor only)
- `.../stages`, `.../stages/{id}/updates`, `.../media` for the construction journey
- `POST /inquiries`, `GET /inquiries/me` (client only); `GET /inquiries/received`, `PATCH /inquiries/{id}/status` (contractor only)

### Frontend

- `/` home, `/contractors` discovery, `/contractors/[id]` public profile, `/projects/[id]` public project page
- `/login`, `/register`
- `/dashboard` contractor overview, `/dashboard/profile`, `/dashboard/projects`, `/dashboard/projects/[id]`, `/dashboard/inquiries/received`
- `/dashboard/inquiries` client workspace

## Testing and verification

```powershell
# Backend tests (106 tests, in-memory SQLite; no database required)
cd backend
..\.venv\Scripts\python.exe -m pytest tests -q

# Full API E2E against a running stack (uses unique test accounts, cleans up after itself)
..\.venv\Scripts\python.exe scripts\e2e_api_test.py

# Frontend checks
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

## Project structure notes

- Role-based access is enforced server-side (`require_role` dependency); the frontend guards only improve UX.
- Ownership checks live in the service layer (`get_owned_*` helpers), so users can never touch another user's resources.
- Login and registration are rate-limited per IP; the limits are configurable via environment variables.
- Media URLs must be `http(s)` and are validated by Pydantic (`AnyHttpUrl`).
