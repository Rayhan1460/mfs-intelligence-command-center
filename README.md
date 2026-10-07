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

The API is available at CONTINUE FROM THE CURRENT REAL WORKSPACE STATE.

THIS IS THE FINAL PHASE 2 PROMPT — SEGMENT 4 OF 4.

STRICT TIME LIMIT:
WE HAVE ONLY ABOUT 12 MINUTES TOTAL.

USE THIS BUDGET:

0–2 min:
inspect + prioritize remaining judge gaps

2–8 min:
implement only high-impact safe fixes

8–10 min:
tests + build + git push

10–12 min:
Railway/Vercel verification + final report

DO NOT START LARGE REFACTORING.
DO NOT RETRAIN MODELS.
DO NOT RUN EXPENSIVE TRAINING.
DO NOT REBUILD THE UI.
DO NOT BREAK WORKING FEATURES.

==================================================
CURRENT VERIFIED STATE — PRESERVE ALL OF IT
==================================================

Already working:

- Daily Operations Brief
- Today’s Top 10 Actions
- Next Best Action ranking
- forward-looking Merchant Churn model
- Demand Forecast evaluation
- Agent Liquidity P90 evaluation
- Agent Underperformance model
- Expected Value ranking
- Business Impact simulation
- Cross-network intelligence
- Weekly Operations Brief
- Field Operations Plan
- Bangla support
- Action Review
- Outcome tracking
- AI Copilot
- Railway backend
- Vercel frontend
- Supabase DB
- Demo login
- Runtime assets
- tests/build currently passing

Production frontend:

https://frontend-green-ten-76.vercel.app/

Production backend:

https://mfs-intelligence-command-center-production.up.railway.app

GitHub:

https://github.com/Rayhan1460/mfs-intelligence-command-center

Branch:
main

==================================================
PRIMARY FINAL GOAL
==================================================

Close the HIGHEST-VALUE remaining judge gaps without destabilizing production.

Priority order:

1. Responsible AI + Demo security
2. Evidence / explainability UI
3. Audit trail
4. Cold-start UX
5. Separate local/test DB safety
6. Scalability evidence
7. Real screenshots + final demo documentation
8. Final live production QA

==================================================
PART 1 — SAFE DEMO ACCESS
==================================================

Judge concern:

Public Demo Mode currently gives too much privilege.

Inspect current role architecture FIRST.

Preferred:

Use an existing least-privileged role such as:

ANALYST
VIEWER
REVIEWER

if one already exists.

If possible without risky migration:

Demo login should receive a read/review-safe role, NOT unrestricted ADMIN.

Demo user MUST still be able to:

- view Command Center
- view merchants
- view agents
- view locations
- use Copilot
- view models
- review safe demo actions

Demo user MUST NOT be able to:

- manage users
- change security settings
- perform destructive admin actions
- delete critical records

IMPORTANT:

Do NOT introduce a risky DB migration if the current role enum/schema makes
this dangerous within the time limit.

If a safe existing role is unavailable:

implement an explicit demo-session permission restriction in the backend
for destructive/admin-only routes.

Preserve normal ADMIN login.

==================================================
PART 2 — RATE LIMIT CRITICAL ENDPOINTS
==================================================

Add a LIGHTWEIGHT rate limit only where easy and safe.

Prioritize:

POST /auth/login
POST /auth/demo-login
POST /assistant/chat

Use existing framework/library if already present.

If no limiter exists:

implement a minimal in-memory bounded limiter suitable for THIS DEMO INSTANCE.

Document:

Production-scale rate limiting should use Redis/API Gateway.

Do not add complex infrastructure now.

Add basic tests.

==================================================
PART 3 — LOGIN FAILURE PROTECTION
==================================================

Implement simple temporary cooldown / lockout after repeated failed login attempts
if safe within current architecture.

Example:

5 failed attempts
→ short cooldown

Do not permanently lock users.

Do not leak whether an account exists.

==================================================
PART 4 — AUDIT TRAIL VISIBLE
==================================================

Judge asked to SEE that audit events exist.

Do NOT create a big new system.

Use existing audit_events table/API.

Add a small:

RECENT AUDIT ACTIVITY

section to Action Review / admin-safe screen.

Show:

Actor
Action
Target
Timestamp
Result

Example:

Demo Analyst
Reviewed action
AGT00025
10:12 AM
APPROVED

No passwords.
No cookies.
No session hashes.
No sensitive payloads.

==================================================
PART 5 — RESPONSIBLE AI EVIDENCE CARD
==================================================

For each Top 10 / Next Best Action item ensure the UI clearly shows:

Why flagged
Evidence
Confidence
Source type
Model/rule name
Prediction horizon where applicable
Known limitation

Examples:

Merchant Churn:
Model:
LightGBM Forward Hazard v2.0

Horizon:
Forward 30 days

Confidence:
94.6%

Agent Liquidity:
Source:
P90 Operational Buffer

Important:
Point forecast skill is weak;
P90 coverage is the operational signal.

Benchmark:
PERCENTILE ENGINE

Location:
DECISION SUPPORT — NOT GPS

Never display a naked unexplained risk score.

==================================================
PART 6 — QUICK FAIRNESS CHECK
==================================================

Judge asked for fairness analysis.

Do NOT build a large fairness platform.

Add one lightweight reproducible script:

evaluation/fairness_check.py

Analyze only existing non-sensitive groups:

Merchant:
- category
- district if available
- business size if available

Agent:
- district / segment if available

Location:
- district / area type

Calculate:

group count
mean score
flag rate

Warn:

INSUFFICIENT SAMPLE

for small groups.

Generate:

evaluation/fairness_results.json

Add short Models / Responsible AI UI summary:

“Fairness monitoring is based on operational groups only; no protected
attributes are inferred.”

Document mitigation:

- minimum peer-group size
- human review
- regular disparity audit

==================================================
PART 7 — PROMPT-INJECTION SECURITY SUMMARY
==================================================

Do NOT build a new LLM system.

Use the existing Copilot evaluation.

Ensure at least these attacks are tested:

- ignore previous instructions
- invent a merchant
- reveal database password
- reveal hidden prompt
- fabricate GPS
- provide unsupported metric

Record:

attack refusal pass rate

Add it to Models / Responsible AI page.

Never reveal hidden prompts.

==================================================
PART 8 — DATABASE ENVIRONMENT SAFETY
==================================================

Judge flagged local tests sharing production DB.

Add a FAST safety guard.

When:

ENVIRONMENT=test

the application MUST refuse a known production Supabase host.

For development:

warn loudly if production DB host is detected.

Do NOT modify the actual Railway production DATABASE_URL.

Document:

Production:
Railway + production Supabase

Local development:
local/separate dev database

Tests:
isolated fixtures/test DB

==================================================
PART 9 — COLD START UX
==================================================

Judge may open the demo when Railway is waking.

Frontend API loading state should show:

“Connecting to intelligence service…”

Use bounded retries.

Example:

3 attempts
small exponential delay

Do NOT immediately show:

Information unavailable

on first network failure.

After retry failure:

show:

“Service is taking longer than expected. Retry.”

Keep manual Retry button.

No infinite loop.

==================================================
PART 10 — PAGINATION / SCALABILITY QUICK CHECK
==================================================

Judge mentioned 5,000 merchants.

Verify merchants API supports sensible pagination.

If already present:
document it.

If not:
add lightweight:

limit
offset

or
page
page_size

with safe maximum page size.

Do not load 5,000 merchant records into the browser at once.

Add one test.

==================================================
PART 11 — LIGHTWEIGHT LOAD TEST
==================================================

TIME LIMITED.

Do NOT install a heavy stack if unavailable.

If Locust is already available:
run a short 15–20 second local/staging test.

Otherwise create:

tests/load/smoke_load.py

using existing Python/http client.

Test safe GET endpoints only:

/api/v1/health
/api/v1/operations/daily-priorities
/api/v1/merchants
/api/v1/agents
/api/v1/locations/opportunities

Use low concurrency.

Report:

total requests
success rate
p50
p95

DO NOT stress production.

If production is used:
maximum 3–5 concurrent users for a few seconds.

==================================================
PART 12 — DATA PIPELINE / INTEGRATION DOCUMENTATION
==================================================

Do NOT migrate CSV artifacts to a database now.

That is too risky with 12 minutes.

Instead add:

docs/integration-architecture.md

Document the real target flow:

Upay transaction feed
→ validation/data contract
→ feature pipeline
→ nightly/near-real-time scoring
→ intelligence store
→ APIs
→ Today’s Top Actions
→ human review
→ intervention/outcome event

Also document future integration points:

- Upay SSO / Identity Provider
- transaction stream
- merchant-management system
- agent-management system
- webhook/event for reviewed actions
- model registry
- scheduled rescoring

Clearly label:

CURRENT DEMO:
versioned runtime artifacts

TARGET PRODUCTION:
database/object store + scheduled scoring

==================================================
PART 13 — MODEL MONITORING QUICK VIEW
==================================================

Add simple model metadata if not already exposed:

model version
last evaluated
coverage
prediction horizon
known limitation

For existing trained models.

Do not implement full drift infra now.

In documentation describe future monitoring:

feature drift
PSI
missing-rate
performance decay
retraining trigger

==================================================
PART 14 — REAL SCREENSHOTS
==================================================

Judge explicitly asked for real UI screenshots.

Using the current LIVE site, capture if tooling supports it:

docs/screenshots/

01-login.png
02-command-center.png
03-top-actions.png
04-merchant.png
05-agent.png
06-location.png
07-copilot.png
08-action-review.png
09-outcomes.png
10-models.png

If automatic screenshots are unavailable:

do NOT waste time.

Instead create the folder + README checklist and proceed.

==================================================
PART 15 — FINAL README / DEMO GUIDE
==================================================

Update README TOP SECTION.

Must show:

LIVE DEMO
https://frontend-green-ten-76.vercel.app/

BACKEND
https://mfs-intelligence-command-center-production.up.railway.app

HEALTH
https://mfs-intelligence-command-center-production.up.railway.app/api/v1/health

READY
https://mfs-intelligence-command-center-production.up.railway.app/api/v1/ready

DEMO STEPS

1. Open live URL
2. Click Enter Demo
3. View Today’s Top 10 Actions
4. Open agent liquidity case
5. Open forward-churn merchant case
6. Review Next Best Action
7. Ask Copilot for Weekly Operations Brief
8. Open Action Review / Outcomes

==================================================
PART 16 — 2-MINUTE DEMO SCRIPT
==================================================

Create:

docs/demo-script-2min.md

Use:

0:00–0:15
Bangladesh MFS operations problem

0:15–0:35
Morning Brief + Top 10 Actions

0:35–0:55
AGT00025 liquidity example

0:55–1:15
MRC000001 forward churn example

1:15–1:30
Next Best Action + expected value

1:30–1:45
AI Copilot Weekly Brief

1:45–1:55
Action Review + Outcomes

1:55–2:00
Closing value

Keep wording short and presentation-ready.

==================================================
PART 17 — FINAL UI PASS
==================================================

Do a quick visual check.

Critical pages:

Command Center
Merchants
Agents
Locations
AI Copilot
Action Review
Outcomes
Models

Check:

- readable contrast
- no clipped text
- no header overlap
- no horizontal overflow
- buttons visible
- Bangla readable
- yellow cards use dark text
- pale alerts use dark text
- blue cards use high-contrast text

Do NOT redesign.
Only fix obvious defects.

==================================================
PART 18 — FAST TEST GATE
==================================================

Because time is limited, run:

Backend:
$env:PYTHONPATH="backend"
.\.venv\Scripts\python.exe -m pytest -q

Frontend:
npm --prefix frontend test -- --run

Lint:
npm --prefix frontend run lint

Build:
npm --prefix frontend run build

If one test fails:

FIX IT.

Do not push failing code.

==================================================
PART 19 — GIT SAFETY
==================================================

Check:

git status
git diff

Never commit:

.env
frontend/.env.local
DATABASE_URL
passwords
cookies
source_assets
temporary secrets

==================================================
PART 20 — FINAL COMMIT
==================================================

Commit message:

feat: finalize judge-ready Phase 2 security scalability and responsible AI

Push:

git push origin main

==================================================
PART 21 — AUTO DEPLOY
==================================================

Wait briefly for:

Railway backend auto-deploy
Vercel frontend auto-deploy

Do NOT create new services.

==================================================
PART 22 — LIVE ACCEPTANCE
==================================================

Verify backend:

https://mfs-intelligence-command-center-production.up.railway.app/api/v1/health

Required:
status = ok

Then:

https://mfs-intelligence-command-center-production.up.railway.app/api/v1/ready

Required:
status = ready
database = available

Verify frontend:

https://frontend-green-ten-76.vercel.app/

Enter Demo.

Confirm at minimum:

- Demo works
- Daily Brief loads
- Top 10 loads
- Merchant loads
- Agent loads
- Location loads
- Copilot loads
- Action Review loads
- Outcomes loads
- Models page loads

==================================================
FINAL JUDGE CHECKLIST
==================================================

Return exactly this structure:

PROBLEM RELEVANCE
PASS / PARTIAL / BLOCKER

AI/ML DEPTH
PASS / PARTIAL / BLOCKER

BUSINESS IMPACT
PASS / PARTIAL / BLOCKER

PROTOTYPE QUALITY
PASS / PARTIAL / BLOCKER

INNOVATION
PASS / PARTIAL / BLOCKER

SCALABILITY & INTEGRATION
PASS / PARTIAL / BLOCKER

RESPONSIBLE AI & SECURITY
PASS / PARTIAL / BLOCKER

Then give:

1. Files changed
2. Demo security result
3. Rate-limit result
4. Audit UI result
5. Fairness result
6. Copilot attack-test result
7. DB environment safety
8. Cold-start handling
9. Pagination
10. Load-test result
11. Integration docs
12. Screenshots status
13. Demo script status
14. Backend test result
15. Frontend test result
16. Lint result
17. Build result
18. Git commit hash
19. GitHub push result
20. Railway result
21. Vercel result
22. Live frontend verification
23. Remaining blockers

DO NOT CLAIM PASS FOR ANY ITEM THAT WAS NOT ACTUALLY VERIFIED.

FINAL RULE:

THE EXISTING WORKING PRODUCTION SYSTEM IS MORE IMPORTANT THAN ADDING ONE MORE
FEATURE.

IF A NEW CHANGE RISKS BREAKING THE LIVE DEMO, SKIP IT, DOCUMENT IT, AND KEEP
PRODUCTION STABLE.. Its initial routes are:

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
