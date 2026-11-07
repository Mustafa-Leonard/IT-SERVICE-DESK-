# Architecture

## Status and scope

This is the approved architecture for a single-organization initial release. The workspace contains a React/Vite frontend, NestJS modular API, PostgreSQL/Prisma schema, and development/production Docker configurations. The initial migration has been applied to a fresh local PostgreSQL database and API readiness has been verified; full portal, production deployment, and recovery validation remain incomplete.

## System shape

Use a modular monolith with clear boundaries:

```text
Browser
  React + TypeScript + Vite
       | HTTPS / REST
NestJS API
  Authentication and authorization
  Domain modules and application services
       | Prisma
PostgreSQL

NestJS integration interfaces
  SMTP email | local/S3-compatible file storage | future monitoring adapters
```

The browser is not trusted to enforce access. Every protected operation is authenticated and authorized by the API, including record ownership and organization scope.

## Frontend

Use React, TypeScript, Vite, React Router, React Hook Form, Zod, TanStack Query, and Lucide React. A shared authenticated shell hosts role-based navigation and pages for the six interfaces. Share components and data-fetching services; do not make six independent SPAs. Super Administrator access has a dedicated `/admin/login` entry and role-guarded `/admin/*` routes; these client guards complement, but never replace, backend authorization.

Use centralized API error handling, route guards for user experience, and permission-aware navigation. Route guards and hidden navigation are not security controls. Keep the approved design tokens in a single CSS token file and use semantic, accessible components. The current UI has working authentication, tickets, asset registration, manual network inventory/status, subnet/IP registration, VLANs, saved topology, network incidents and maintenance, configuration history/backup upload, knowledge reading, notifications, reports, and user administration. Other asset and administration lifecycle actions remain API-only.

## Backend modules

Organize NestJS modules around domain responsibilities and keep business rules in services rather than controllers:

- Authentication, sessions, users, roles, permissions
- Organizations, departments, locations
- Tickets, ticket history, comments, attachments, SLAs
- Incidents, problems, changes, approvals, maintenance
- Assets and asset lifecycle
- Network devices, IPAM, subnets, VLANs, topology, configurations
- Knowledge base, notifications, reporting
- Audit, system configuration, health/readiness
- Integration ports for email, file storage, and future monitoring

Use DTO validation, centralized exception handling, structured logs, Swagger/OpenAPI, and explicit service-level authorization checks. Use transactions for multi-record lifecycle operations.

## Organization boundary

Create one Organization record during initial setup. Organization-owned records carry an `organizationId` foreign key, including users, departments, locations, tickets, assets, and network inventory. Scope API queries and unique constraints to that organization where appropriate. Resolve the active organization on the server; never trust an arbitrary organization ID supplied by a client.

This reduces future migration scope but does not make the first release fully multi-tenant. A future multi-organization release still needs tenant-isolation tests, organization-aware identity/session behavior, storage namespacing, operational controls, and a reviewed migration.

## Authentication and initial setup

The first Super Administrator is created by a CLI bootstrap command, not a public HTTP route. The command accepts environment-provided values, hashes the password, avoids logging secrets, and creates the organization and administrator transactionally. A repeat with the same organization and active, verified Super Administrator is a no-op; mismatched or partial initialized states are refused. Bootstrap credentials remain deployment inputs and must not be committed.

Use Argon2id for passwords. Use short-lived access tokens and a rotating refresh-token mechanism in Secure, HTTP-only, appropriately SameSite cookies. Apply CSRF defenses to cookie-authenticated state-changing requests, login rate limits, session revocation, and generic password-reset responses to reduce account enumeration. Store reset/activation token hashes with expiry and one-time use.

Authorization combines role/permission checks with resource-level rules (for example, employee owns ticket; technician has assignment or explicit permission). Backend enforcement is mandatory. Audit role changes, account deactivation, sensitive network access, and other privileged operations.

## Provider-independent integrations

### Email and notifications

Define a mailer interface with SMTP as the initial implementation. Persist in-app notifications first. Missing SMTP configuration is reported as unavailable; do not silently pretend a message was sent. SMTP delivery queueing/retries and other channels remain future work.

### File storage

Define a storage interface with a local filesystem adapter for development and an S3-compatible adapter for production. Persist metadata (owner, organization, entity association, original name, detected media type, size, checksum, storage key, timestamps) in PostgreSQL; store no file bytes in the database.

Use opaque keys, private buckets/volumes, allowlisted and content-verified formats, configured size limits, safe download authorization, and non-public access. The implemented allowlist is PDF, JPEG, PNG, plain text, and CSV. Retention and malware scanning are not implemented and must be resolved before production uploads.

### Network monitoring boundary

The initial release stores manually maintained status and the actor/time of the update. A future monitoring adapter may later ingest ICMP/SNMP observations. Model status provenance (manual versus collector) and observation time explicitly. Do not create mock measurements or describe manually entered status as live monitoring.

## Deployment and operations

Use Dockerfiles for frontend and backend and Docker Compose for development. Development Compose may expose PostgreSQL only to the local development environment and use a named volume. Production Compose/deployment keeps PostgreSQL on a private network without a public host port and uses persistent storage.

Make the application reverse-proxy and HTTPS ready for a Linux VPS or private server. Keep configuration in environment variables/secrets, distinguish development and production settings, provide health checks, emit structured logs to standard output, and document database migration, backup, restore, upgrade, and rollback procedures. Backups must be tested by restoration, not merely generated.

## Observability and error handling

Use structured application logs with request correlation and useful operational context, excluding passwords, tokens, attachment contents, and other sensitive data. Health endpoints should distinguish process liveness from database/dependency readiness. Return safe client errors without stack traces; preserve enough server-side diagnostics to investigate failures.

## Key risks and mitigations

- **Broad scope:** Deliver vertical slices and establish an end-to-end ticket workflow before expanding portals.
- **Access-control gaps:** Centralize permission checks and test ownership, role, and organization boundaries.
- **Sensitive network data:** Restrict configuration access, protect backups, and audit reads/changes where appropriate.
- **External service configuration:** Use explicit adapter health/configuration states; never report unconfigured integrations as working.
- **File security and retention:** Decide file policy and production storage controls before enabling production uploads.
- **Future multi-tenancy:** Include organization ownership now while clearly deferring full tenant isolation guarantees.
- **Reporting ambiguity:** Define SLA clocks, business hours, pause rules, and report formulas before treating metrics as authoritative.
- **Database migration verification:** Prisma 7.10.1, the PostgreSQL driver adapter, and generated client are in use. The initial migration has been applied to a newly created local PostgreSQL volume and a repeat deployment reports no pending migrations. Production migration, backup, and restoration checks remain outstanding.
- **Dependency security:** The last dependency audit reported no known vulnerabilities. Repeat audits as part of release checks.
