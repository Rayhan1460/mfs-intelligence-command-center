# Human Action Center

The action center stores proposals and human decisions; it does not execute operations. No endpoint moves money, rebalances cash, suspends merchants, changes credit, or triggers external upay actions.

## Intervention workflow

`POST /api/v1/interventions` accepts a canonical merchant, agent, or location target and creates a `PROPOSED` record. Admins, analysts, and regional managers may propose. Only a regional manager or admin may decide status:

- `PROPOSED` -> `APPROVED`, `REJECTED`, or `DISMISSED`
- `APPROVED` -> `IN_PROGRESS` or `DISMISSED`
- `IN_PROGRESS` -> `COMPLETED` or `DISMISSED`

Terminal statuses cannot be reopened. Approval/rejection records `approved_by`; all creation and status changes append sanitized audit events. Judges can read only. Merchant/agent accounts can read only interventions linked to their own entity and cannot approve.

Every decision requires an authenticated session and a matching CSRF cookie/header token. Consequential activity remains subject to human review; status progression is recordkeeping, not an instruction to execute an external action.

## Feedback

`POST /api/v1/feedback` stores analyst/admin human feedback for a canonical entity. Intelligence references are allowlisted and small; comments and ratings are not used to update models. Read access is available to admin, analyst, regional manager, and judge; merchant/agent users are restricted to their own linked entity. Feedback is evidence for future review only and never triggers automatic retraining.

## Audit and storage

Audit events include login success/failure, logout, intervention creation/status changes, feedback creation, and admin registry access. They do not contain passwords, session tokens, CSRF tokens, or stack traces. Application records use PostgreSQL in production. Tests use an isolated SQLite database; synthetic intelligence remains served from cached batch artifacts and is not copied into the database.