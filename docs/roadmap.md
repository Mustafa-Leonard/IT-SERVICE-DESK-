# Development Roadmap

## Status

The user approved implementation across all phases. The foundation and initial domain slices are implemented, but no phase is declared complete until its exit criteria are validated. Current blockers are unavailable Docker/database runtime verification, limited end-to-end coverage, and unfinished UI/policy work.

## Phase 0 — Requirements and architecture

- Record the approved single-organization scope, future organization boundary, bootstrap admin approach, provider-independent integrations, Docker deployment targets, and manual-only network status.
- Establish frontend/backend/database boundaries, proposed schema, role scope, security posture, design system, risks, and open decisions.
- Confirm critical policies before implementing affected workflows.

**Exit:** Requirements and architecture are approved; no unresolved decision prevents the first vertical slice.

## Phase 1 — Foundation and reproducible development

- Create frontend and backend workspaces, formatting/type-checking/testing conventions, environment validation, Dockerfiles, and development Compose.
- Add PostgreSQL, Prisma, initial Organization record/migration strategy, API health/readiness, structured logging, and CI checks.
- Add the Executive Slate token file and shared application shell structure.

**Exit:** Partially met. Frontend/backend builds, lint, seven backend unit tests, one e2e test, Prisma schema validation, and development/production Compose static checks pass. The full-schema initial migration (45 tables, 11 enums, 101 foreign keys) has been applied to a fresh local PostgreSQL volume; a second deploy reports no pending migrations. The host frontend and API are running against this database. The complete development Compose frontend/backend stack and production stack remain unverified.

**Validation note:** Docker CLI/Compose and the `desktop-linux` context are available. PostgreSQL is healthy in Docker and bound to loopback only. The migration image builds with OpenSSL installed. The full frontend/backend Compose stack has not been started.

## Phase 2 — Identity, bootstrap, and authorization

- Implement the one-time secure Super Administrator CLI bootstrap.
- Implement login/logout, session and refresh-token handling, rate limiting, account activation, password reset, users, roles, permissions, departments, and locations.
- Add server-side RBAC, object ownership and organization-scope checks, and audit records.

**Status:** Implemented APIs for protected bootstrap, login/refresh/logout, activation/reset, RBAC, users, departments, and locations. Added a dedicated Super Administrator login, role-guarded admin dashboard/users routes, and a repeat-bootstrap no-op for a matching initialized organization/admin. The initial Super Administrator is provisioned; API login, `auth/me`, 28 static authorized GET routes, and unauthenticated 401 checks passed. Authenticated browser workflows, ownership, reset-token, and broader authorization behavior still need comprehensive tests.

**Exit:** Not yet met.

## Phase 3 — Ticket workflow vertical slice

- Implement employee ticket submission and own-ticket views.
- Implement technician queue, assignment, comments/internal notes, status history, escalation, and resolution.
- Add in-app notifications, initial SLA policy model, and API documentation.
- Verify the complete employee-to-technician workflow through integration and UI tests.

**Status:** Ticket submission, scoped queue/detail access, assignment, comments/internal notes, status history, notifications, categories, and basic elapsed-minute SLA policies are implemented. UI covers ticket creation, details, comments, and assigned-ticket status updates.

**Exit:** Not yet met; full ticket lifecycle requires a working database and end-to-end tests.

## Phase 4 — Secure files and knowledge

- Implement local development file storage behind the storage interface and PostgreSQL metadata.
- Enforce upload/download authorization, type verification, size limits, and safe error handling.
- Add knowledge articles and revisions; prepare the S3-compatible adapter for production configuration.

**Status:** Local and S3-compatible adapters, metadata, ticket/network attachment endpoints, content/size checks, and authorized downloads are implemented. The allowlist is PDF/JPEG/PNG/text/CSV. Malware scanning and retention are not implemented.

**Exit:** Not met; production file policy and storage integration tests are required.

## Phase 5 — Asset management

- Implement inventory, unique asset tags, allocations, transfers, maintenance, repairs, and disposal history.
- Add relevant employee/technician views and asset reporting.

**Status:** Asset APIs cover registration, unique/generated tags, assignments, transfers, condition/status, maintenance, and disposal with audit/history. The UI currently covers registration and inventory listing only.

**Exit:** Not met; lifecycle UI, integration tests, and policy validation remain.

## Phase 6 — Network documentation

- Implement devices, IPAM, subnets, VLANs, saved topology, configuration records, incidents, and maintenance.
- Distinguish manual device status from future collected observations. Do not ship simulated monitoring.

**Status:** APIs cover devices, manual status/provenance, IPAM, subnets, VLANs, saved topology, configuration metadata, incidents, and maintenance. The UI includes device inventory/status, subnet and IP registration, VLAN creation/linking, a graphical view of saved topology connections, network incident status, maintenance scheduling/status, and configuration history with protected backup upload and authorized download. Full metadata editing and authenticated workflow tests remain.

**Exit:** Not met; full metadata editing and authenticated database-backed integration tests remain.

## Phase 7 — Management and administration

- Add management dashboards, workload/SLA reports, approvals, authorized exports, configuration UI, audit/security views, and backup records.
- Ensure all statistics are computed from real records and scope reports by permissions.

**Status:** APIs cover real-record overview/SLA reports, change approval, audit reads, and non-secret settings; UI includes reports and basic user administration. The report uses elapsed-minute targets, not business hours.

**Exit:** Not met; role/permission, audit, settings and approval UI and report-policy sign-off remain.

## Phase 8 — Production readiness

- Complete unit, integration, end-to-end, security, accessibility, and performance checks.
- Verify production builds and Docker deployment; keep PostgreSQL private.
- Document HTTPS/reverse-proxy setup, secrets, SMTP/S3 configuration, migrations, logging, backups, restore, upgrades, and recovery.
- Perform a backup restoration exercise and produce a release-readiness report.

**Status:** Dockerfiles, development/production Compose, private production database networking, health checks, deployment guidance, and a generated full-schema migration exist. Local Docker PostgreSQL startup and migration deployment are verified; production deployment and backup/restore are not. SMTP and S3-compatible production integrations are not configured, file malware scanning/retention policy is unresolved, and the complete container stack has not been exercised. Do not deploy the current state.

**Exit:** Not met.

## Decisions to confirm before affected implementation

These are policy/configuration details, not blockers to the architecture assessment:

1. **Ticket SLAs:** Business hours/time zone, holidays, response/resolution definitions, pause rules, escalation thresholds, and reopened-ticket behavior.
2. **File policy:** Permitted file types, maximum sizes, retention/deletion period, and whether malware scanning is required before production uploads.
3. **Production routing:** Preferred reverse proxy (for example, Caddy or Nginx), domain/certificate ownership, and whether the frontend is served by the proxy or container.
4. **Account lifecycle:** Whether account activation links and password-reset links must be email-only, and what operational procedure is used if SMTP is unavailable.
5. **Bootstrap operation:** Preferred deployment method for the one-time admin command (interactive shell or injected deployment secret); credentials must be supplied securely either way.
6. **Data retention:** Audit-log and attachment retention requirements and any jurisdictional constraints.
7. **Malware scanning:** Select a scanner and fail-closed upload behavior before enabling production uploads.
8. **Database migration:** Apply the generated full-schema initial migration to PostgreSQL, verify clean deployment, and test backup/restore.

SMTP host/credentials, S3-compatible endpoint/credentials, and production secrets are deployment configuration, not source-code requirements. They must be supplied by the operator and must not be invented or committed.

The currently implemented upload limit defaults to 10 MiB and can be set up to 50 MiB. The production environment forces S3-compatible storage and HTTPS URLs. SMTP remains optional at startup but activation/reset mail operations fail explicitly until it is configured.
