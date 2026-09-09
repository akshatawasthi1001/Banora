# Banora

Banora is a professional contractor discovery and construction portfolio platform.

This repository currently contains the initial application foundation:

- `backend/`: FastAPI application with a versioned API router and health check.
- `backend/alembic/`: Alembic migration environment and database migrations.
- `frontend/`: Next.js App Router application with TypeScript and Tailwind CSS.
- `docker-compose.yml`: Local backend, frontend, and PostgreSQL services.

## Run Locally

### Backend

From the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. Check `http://localhost:8000/health`.

### Database migrations

For local non-Docker development, copy `backend/.env.example` to `backend/.env` and set `DB_PASSWORD` to a local PostgreSQL password.

```powershell
cd backend
alembic upgrade head
```

### Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The web app runs at `http://localhost:3000`.

## Run With Docker

From the repository root:

```powershell
Copy-Item backend\.env.example .env
# Set DB_PASSWORD in .env before starting the services.
docker compose up --build
```

Stop the services with:

```powershell
docker compose down
```

The current foundation intentionally does not include authentication, domain models beyond `User`, project workflows, reviews, or AI functionality.