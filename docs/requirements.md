# IT Service Desk & Network Asset Management System

## Status

Approved requirements baseline. The application now includes the main identity, ticket, asset, network documentation, knowledge, notification, reporting, and administration APIs, plus initial React workflows. Database-backed end-to-end verification and production release checks are still pending; see the [roadmap](./roadmap.md).

## Product objective

Build one secure, maintainable IT operations application for a single organization, covering employee support, IT service operations, asset lifecycle management, network documentation, management oversight, and system administration. The initial deployment serves one organization with multiple departments, locations, employees, and IT teams. The design must establish organization boundaries so that a later multi-organization version can be introduced without redesigning every domain.

The application is a modular monolith, not six separate applications. It must use real persistence and real integrations when configured. Unavailable integrations must be reported as unavailable; simulated monitoring data and success-shaped placeholders are prohibited.

## Approved product and deployment decisions

- **Organization model:** One organization initially. Include an organization identity and organization scope on organization-owned data from the start. Treat this as a future-enabling boundary, not a claim that multi-tenancy is already supported.
- **Initial administrator:** Provision the first Super Administrator using a protected, one-time CLI setup command or secure environment-provided setup values. Do not expose a public setup endpoint, commit credentials, log passwords, or retain bootstrap credentials. Refuse to create a second initial administrator through this mechanism.
- **User lifecycle:** Super Administrators can create and deactivate accounts, assign roles, and manage permissions. Provide account activation and secure password reset workflows.
- **Email:** SMTP is the initial provider, accessed through a provider-independent backend interface. Resend, SendGrid, and other providers may be added later.
- **Notifications:** Implement persisted in-app notifications first. Email and SMS are later delivery channels; an unconfigured channel must not appear operational.
- **Files:** Local filesystem storage for development and S3-compatible object storage for production, behind a storage interface. PostgreSQL stores metadata and opaque storage references, never file contents.
- **Network operations:** First release is inventory and documentation with manually updated device status. Live ICMP/SNMP monitoring is future work and must not be simulated.
- **Deployment:** Docker and Docker Compose for development and Linux VPS/private-server deployment. Include frontend/backend images, PostgreSQL for development, persistent database storage, health checks, logging, backup/restore procedures, HTTPS and reverse-proxy readiness. Production database access must remain private.

## Roles and interfaces

All interfaces share authentication, navigation patterns, design tokens, and reusable components. The backend remains the source of truth for authorization.

| Interface | Initial responsibilities |
| --- | --- |
| Employee / end user | Submit and follow tickets; communicate with technicians; see assigned assets; read knowledge articles; receive notifications; manage own profile. |
| IT Technician | Work ticket queues and assignments; record troubleshooting and internal notes; manage incidents, problems, approved maintenance, and knowledge articles; escalate and resolve tickets. |
| Network Administrator | Maintain devices, IPs, subnets, VLANs, topology, configuration records, network incidents, and network maintenance; manually record device status. |
| IT Asset Manager | Register and allocate assets; track transfers, locations, warranties, repairs, condition, costs, and disposal; maintain asset history. |
| IT Manager | Review real ticket, SLA, workload, incident, and asset metrics; manage operational oversight, approvals, and authorized reports. |
| Super Administrator | Manage users, roles, permissions, departments, locations, system settings, security events, audit logs, integrations, and backup records. |

Employees may access only their own records unless an explicit permission allows otherwise. Technician assignment changes and privileged administration require specific permissions.

## Core functional requirements

### Service desk

- Tickets have a requester, category, priority, status, timestamps, and organization scope.
- Support comments/conversation, separately protected internal notes, attachments, assignment history, and status history.
- Employees can submit and view their tickets. Authorized technicians can accept, update, escalate, and resolve assigned or permitted tickets.
- Incident, problem, change, approval, maintenance, and knowledge workflows are linked where appropriate.
- Dashboard statistics, reporting, and SLA metrics are derived from persisted records.

### Assets

- Record unique asset tags and, where available, serial numbers.
- Track category, specifications, purchase and warranty information, supplier, department, location, condition, and lifecycle.
- Record allocations, transfers, maintenance/repair, expenses, loss/damage, retirement, and disposal with an auditable history.

### Network documentation

- Maintain network-device inventory, address and subnet records, VLANs, saved topology connections, device configuration records, incidents, and maintenance.
- Validate IP/CIDR data and applicable uniqueness constraints.
- Store configuration backup content in protected file storage or references to approved secure storage.
- Mark device status as manually recorded in the first release. Design a monitoring integration boundary for future collectors, but do not expose monitoring results until real collection is implemented.

### Administration and reporting

- Manage users, roles, permissions, departments, locations, ticket categories/statuses/priorities, SLA policies, and application settings.
- Log significant security and operational actions.
- Calculate reports from authorized, real database records and scope queries to the caller's organization and permissions.

## Authentication and security requirements

- Hash passwords with Argon2id.
- Use short-lived access credentials and secure HTTP-only refresh cookies with appropriate SameSite, Secure, and CSRF protections.
- Implement login throttling, logout/session invalidation, account activation/deactivation, and reset links with random, one-time, expiring tokens stored hashed.
- Enforce least-privilege RBAC and object-level authorization on every protected API operation.
- Audit privileged changes and important record lifecycle actions.
- Validate inputs, restrict file types and sizes, authorize each file read/download, and keep storage private.
- Address XSS, CSRF where applicable, injection, broken access control/IDOR, sensitive-data exposure, secure headers, CORS, dependency risks, secrets, and safe error responses.
- Use environment configuration or deployment secrets for credentials. Never commit secrets or expose production database ports publicly.

## Design and accessibility

Use the approved Executive Slate design system from the UI/UX addendum: shared CSS tokens, neutral surfaces, restrained navy/teal accents, consistent typography and spacing, Lucide icons, clear focus indicators, semantic HTML, responsive layouts, and reduced-motion support. Avoid visual-only functionality: every visible control must lead to a working route or action.

## Definition of done

A feature is complete only when its frontend, API, database behavior, authorization, validation, error states, relevant tests, and documentation work together. Production readiness additionally requires verified builds, migrations, tests, Docker configuration, backups/restoration, deployment instructions, and no critical unresolved security or functionality defects.

## Current implementation boundaries

- The backend is a single-organization modular monolith with organization scoping in service queries. Full multi-tenant isolation is not claimed.
- Network status is saved with a manual provenance value. No ICMP/SNMP collection or simulated live monitoring is included.
- SLA targets currently use elapsed minutes; business calendars, time zones, holidays, pause rules, and escalation schedules remain policy decisions.
- Uploads are restricted to PDF, JPEG, PNG, plain text, and CSV and have a configurable size limit (10 MiB by default). Malware scanning and retention automation are not implemented; production upload approval must wait for those policies and controls.
- SMTP is required for activation and reset mail. Unconfigured mail fails explicitly; no queue/retry service is implemented.
- S3-compatible storage is required by production configuration. The production container and object-storage connectivity have not been runtime-tested in this workspace.
- The UI covers login, password activation/reset, ticket workflows, asset registration, manually recorded device status, IPAM, VLANs, saved topology, network incidents and maintenance, configuration history/backup upload, knowledge reading, notifications, reports, and basic user administration. A dedicated Super Administrator login, role-guarded dashboard, and user-management route are present. Asset lifecycle actions, approvals, role/permission editing, audit/settings views, and several role-specific workspaces remain incomplete or API-only; see the [page inventory](./page-inventory.md) and [audit report](./audit-report.md).
