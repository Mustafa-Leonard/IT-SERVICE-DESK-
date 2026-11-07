# System Audit Report

**Assessment run:** 2026-11-07  
**Overall release status:** **Not release-ready**  
**Scope:** Existing React/Vite, NestJS, Prisma/PostgreSQL, and Docker Compose implementation. No production deployment, destructive database operation, credential disclosure, or authorization bypass was performed.

## Executive summary

The project is a modular monolith with substantial domain APIs and a smaller set of frontend workspaces. The public entry points and core ticket, network-documentation, report, and user-management screens exist, but the six requested role portals are not complete. Several lifecycle and administrative workflows are API-only. The initial Super Administrator is now provisioned; API login and `/auth/me` succeed, and 28 static GET endpoints responded successfully as that role. Authenticated browser workflows and the other role portals remain unverified. Account-specific bootstrap values were found in `.env.example` and removed; do not reuse that password if it was used elsewhere.

During this assessment, a fresh local PostgreSQL volume was started in Docker, the full initial migration was applied, and the host frontend/API were verified against the database. Docker Desktop/CLI and the `desktop-linux` context are operational even though the Windows service reports stopped. The Docker extension was not found in the standard VS Code stable/Insiders extension directories; no global VS Code settings or extensions were changed.

## Verified runtime results

| Check | Result | Evidence |
| --- | --- | --- |
| Docker CLI / Compose | Pass | Docker 29.9.2; Compose 5.6.1 |
| Docker context | Pass | Selected context is `desktop-linux`; daemon API responds |
| VS Code Docker extension | Not detected | No Docker/container extension directory under standard stable or Insiders extension folders; VS Code CLI is not on PATH |
| Compose configuration | Pass | Development Compose validates after creating an ignored local `.env` with generated development-only secrets |
| PostgreSQL container | Pass | `postgres:17-alpine` healthy, bound to `127.0.0.1:5432` |
| Initial migration | Pass | `20261107103000_initial` applied to the new helpdesk volume; subsequent deploy reports no pending migrations |
| Initial administrator bootstrap | Pass | Super Administrator created; repeat invocation made no changes |
| Backend Docker image | Pass | Image builds after adding OpenSSL; Prisma no longer emits the missing-OpenSSL warning |
| Frontend | Pass | `http://localhost:5173/` returns HTTP 200; production build passes |
| API health | Pass | `/api/v1/health` returns HTTP 200 with database `ok` |
| Swagger UI | Pass | `/api/docs` returns HTTP 200 |
| Unauthenticated ticket API | Pass | `/api/v1/tickets` returns HTTP 401 |
| Full Compose app stack | Not run | Database and migration ran in Docker; frontend/API development servers ran on the host |

Unrelated stopped Docker containers and their volumes were observed and left unchanged. The production database configuration continues to keep PostgreSQL off a public host port.

## Frontend and authorization

- `/admin/login` now renders a dedicated Super Administrator sign-in screen; password-reset mode toggles correctly.
- An unauthenticated visit to `/admin/dashboard` redirects to `/admin/login`.
- `/admin/dashboard` and `/admin/users` are gated by the `super_admin` role; the sidebar exposes administration only to that role.
- The Super Administrator account is provisioned. API login and `/auth/me` confirmed the `super_admin` role; authenticated reads returned 200 for 28 static GET endpoints, while unauthenticated network/admin reads returned 401.
- Authenticated browser interactions remain untested; API authorization checks do not prove the role-guarded UI and its tabs work end to end.
- The dedicated admin login was checked at 375, 768, and 1440 pixel widths with no horizontal overflow. Prior browser checks also verified the public landing/login/reset/activation views.
- Existing UI areas include ticket list/detail, asset registration/list, network inventory/documentation, knowledge reading, notifications, reports, system health, and basic user management. See the [page inventory](./page-inventory.md) for missing screens and role mapping.
- `NetworkPage` renders saved topology connections and offers authorized configuration-backup downloads. The frontend build and lint pass, but authenticated browser testing of these controls remains unverified. Full device/IPAM metadata editing remains incomplete. No live network monitoring is simulated.

## Backend and data coverage

The Prisma schema contains 45 models/tables, 11 enums, and 101 foreign keys. The backend exposes 96 route handlers. Implemented route families include authentication/session lifecycle, users/RBAC, departments/locations, ticket workflows and SLA policies, asset lifecycle APIs, network inventory/IPAM/VLAN/topology records, knowledge, attachments, notifications, reports, incidents/problems/changes/approvals, admin settings/audit reads, and health.

Important UI gaps remain despite backend support: asset lifecycle, incidents/problems/changes/approvals/maintenance, knowledge authoring, role/permission editing, departments/locations, admin audit/settings, integration status, and backup records.

## Code and test results

- Frontend production build: passed.
- Frontend lint: passed with one existing React Compiler warning about manual memoization in `AppShell`.
- Backend build and type-check: passed.
- Backend lint: passed.
- Backend unit tests: 7 passed across 4 test files, including the new bootstrap-state policy tests.
- Focused bootstrap policy tests: 2 passed; backend lint and full backend TypeScript no-emit check passed after the advisory-lock fix.
- Backend e2e: one test passed, but it mocks health dependencies and is not evidence of full authenticated workflow coverage.
- Prisma migration: applied successfully to a fresh local database.

## Repairs made during this assessment

- Added dedicated Super Administrator login and protected dashboard/user routes.
- Changed administration navigation to be role-based rather than merely checking `user.read`.
- Made repeat bootstrap a no-op only when the matching organization and active, verified `super_admin` account already exist; partial or mismatched initialized states still fail closed.
- Added focused unit tests for bootstrap-state matching and made the CLI load the ignored root `.env` when present.
- Fixed the bootstrap advisory lock to use a result-free SQL block, then verified successful initialization and idempotent rerun against the local PostgreSQL database.
- Installed OpenSSL in the backend base image to remove Prisma runtime detection warnings.
- Configured the ignored root `.env` for local runtime and administrator bootstrap. The example template contains no account-specific credentials; SMTP/S3 credentials remain unconfigured.
- Removed account-specific bootstrap values from `.env.example`; the template now leaves organization/admin fields blank.

## Outstanding release blockers

1. Complete authenticated, role-specific browser/API tests for the six interfaces, including ownership and authorization-denial cases. Static Super Administrator GET smoke tests pass, but do not cover mutations or full browser workflows.
2. Implement the missing screens and workflows listed in the [page inventory](./page-inventory.md); reconcile the 51-versus-52 page-count mismatch against the original itemized list.
3. Complete network device/IP metadata editing and test saved topology/authorized backup downloads with an authenticated network administrator.
4. Test the complete development Compose frontend/backend stack and the production build.
5. Configure SMTP/S3 in a secure environment; verify activation/reset delivery and object-storage authorization. These providers are intentionally not represented as working while unconfigured.
6. Finalize file malware-scanning and retention policies, then perform upload/download and access-control tests.
7. Rehearse production backup restoration, HTTPS/reverse-proxy deployment, migrations, and rollback.

**Deployment recommendation:** Do not deploy to production until the blockers above are addressed and release evidence is recorded.
