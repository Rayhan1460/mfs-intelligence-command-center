# MFS Intelligence Command Center

Phase 1 establishes the application foundation for the AI Hackathon 2026 Track 05 project. It does not yet implement intelligence screens, model inference, data ingestion, authentication, or operational workflows.

## Project Structure

- `backend/`: FastAPI API, Pydantic settings, SQLAlchemy, and Alembic configuration.
- `frontend/`: Next.js App Router with TypeScript and Tailwind CSS.
- `infra/`: Infrastructure notes; local services are defined in the root Compose file.
- `tests/`: Focused API foundation tests.
- `docs/`: Requirements, audit, registry, and implementation planning documents.
- `source_assets/`: Original synthetic source package; excluded from Git and unchanged by this phase.

## Local Setup

Copy the example environment file, then start PostgreSQL/PostGIS and the API:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

The API is available at `http://localhost:8000`. Its initial routes are:

- `GET /api/v1/health`: process liveness; does not require PostgreSQL.
- `GET /api/v1/ready`: readiness; returns unavailable until PostgreSQL responds.

The local database credentials in `.env.example` are development-only. Replace them before any shared or deployed use. Start the frontend separately:

```powershell
cd frontend
npm install
npm run dev
```

The frontend shell is available at `http://localhost:3000`.

## Backend Checks

With the project's Python dependencies installed:

```powershell
python -m pip install -r backend/requirements-dev.txt
python -m pytest
```

## Data And Model Boundaries

All supplied data and intelligence artifacts are synthetic. This foundation does not load or serve them, and does not retrain or replace any model. Any future Merchant Demand integration must remain a category-level next-day point forecast; Agent Liquidity must remain next-day only. Consequential actions require human review. See the documents in `docs/` before implementing later phases.