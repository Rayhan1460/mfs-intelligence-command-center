# Authentication and RBAC

## Authentication

`POST /api/v1/auth/login` verifies Argon2 password hashes and issues an opaque, cryptographically random session token in the configured HttpOnly cookie. The database stores only its SHA-256 hash. Sessions expire after `SESSION_TTL_MINUTES`; logout marks the session revoked and clears both cookies. `/api/v1/me` returns the authenticated user without password/session secrets.

The readable `mfs_csrf` cookie contains a separate random CSRF token. For authenticated POST/PATCH/DELETE requests, the client must copy that value into `X-CSRF-Token`; the server compares cookie/header values and verifies the token against its database hash. Login is exempt from CSRF but checks the `Origin` header when present against `FRONTEND_ORIGIN`; credentialed CORS is restricted to configured origins.

Configure `SESSION_COOKIE_NAME`, `SESSION_TTL_MINUTES`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`, and `FRONTEND_ORIGIN` through environment settings. Secure cookies are forced in production and whenever SameSite is `none`. Use HTTPS and `SESSION_COOKIE_SECURE=true` outside local development.

Login failures are throttled in process memory after five failures per email/IP key in a 15-minute window. This is a hackathon control only; multi-instance production requires shared rate limiting such as Redis.

## Roles

- `ADMIN`: all demo intelligence and workflow access; can create proposals, decide workflow states, read the registry, and manage authorized demo operations.
- `ANALYST`: read intelligence, create proposed interventions, and submit feedback; cannot approve or alter intervention status.
- `REGIONAL_MANAGER`: read intelligence, create proposals, approve/reject proposals, and advance approved work through in-progress/completed/dismissed states.
- `JUDGE`: read-only intelligence, interventions, feedback, and model registry; cannot mutate.
- `MERCHANT`: read only the linked merchant identity/intelligence, the inherited category forecast, and own intervention/feedback records.
- `AGENT`: read only the linked agent identity/intelligence and own intervention/feedback records.

Health and readiness remain public. Role and entity checks run on the backend; client-side visibility is not authorization. Unknown or cross-entity requests return a safe 403 without revealing another entity's details.

## Database and tests

Production uses PostgreSQL through `DATABASE_URL`; SQLAlchemy models avoid PostGIS-specific geometry. Alembic migration `20261003_0001` creates the auth, workflow, audit, and model-version tables. Automated tests create an isolated in-memory SQLite database and override the request session dependency, so tests require neither Docker nor a running PostgreSQL service.

Create demo users with `python -m scripts.create_user --email ... --display-name ... --role ...` from `backend/`. The command prompts for a password, requires 12 characters, hashes it with Argon2, and validates linked merchant/agent IDs against canonical synthetic data. It does not accept passwords as command-line arguments.