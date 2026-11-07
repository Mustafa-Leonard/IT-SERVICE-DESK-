# Database Design

## Status

The Prisma schema now contains organization/identity, ticket/SLA, service operations, asset lifecycle, network/IPAM, attachment/storage metadata, knowledge, notification, audit, and settings models. It is the source for the initial migration; database application and migration consistency still need runtime verification.

## Design principles

- PostgreSQL is the source of truth; Prisma manages access and migrations.
- Use UUID primary keys, foreign keys, explicit timestamps, and database-enforced constraints.
- Include an `Organization` table from the first migration and `organizationId` on organization-owned records. The initial deployment has one organization.
- Enforce uniqueness within the correct organization scope for organization-managed keys, asset tags, devices, IP addresses, subnets, VLANs, and categories.
- Index common list filters and joins: organization, requester, assignee, status, priority, location, and lifecycle timestamps.
- Use transactions for related state changes, such as ticket status plus status history, asset allocation plus assignment history, and initial organization/admin creation.
- Prefer append-only history/audit records for traceability. Use soft deletion only where restoration and legal/operational requirements justify it.

## Entity groups

### Organization and access control

- `Organization`: initial organization identity and configuration.
- `User`: identity, email, password hash, account state, activation metadata, and optional department/location references.
- `Role`, `Permission`, `UserRole`, `RolePermission`: many-to-many RBAC relationships, scoped to the organization where roles are organization-managed.
- `Department`, `Location`: organization-owned records.
- `Session` or `RefreshToken`: hashed/revocable refresh-token state and expiry.
- `PasswordResetToken`, `AccountActivationToken`: hashed, expiring, single-use token records.

Avoid storing plaintext tokens or passwords. Keep authorization checks independent from frontend role labels.

### Service desk

- `Ticket`: organization, requester, category, status, priority, subject/description, optional assignee/asset, and lifecycle timestamps.
- `TicketCategory`, `SlaPolicy`: organization-specific configurable definitions.
- `TicketAssignment`: assignment history (assignee, assigning actor, timestamps, outcome); current assignment may be represented on the ticket or derived consistently from this history.
- `TicketComment`: author, body, visibility (public/internal), and creation time.
- `Attachment`: metadata and opaque storage key, linked to a ticket/comment or other allowed record.
- `TicketStatusHistory`: prior/new status, actor, timestamp, and optional reason.
- `Incident`, `Problem`, `ChangeRequest`, `Approval`, `MaintenanceTask`: operational records linked to relevant tickets/assets/devices and actors.

Do not conflate an internal note with an employee-visible comment. Every read and update is subject to object-level authorization.

### Asset lifecycle

- `AssetCategory`, `Asset`: unique organization-scoped asset tag, optional serial, specifications, purchase/warranty/supplier information, condition, status, and current location.
- `AssetAssignment`: user/asset allocation history with start/end and issuing/receiving actors.
- `AssetTransfer`: source/destination department/location and approval/history.
- `AssetMaintenance`: repair or maintenance details, costs, vendor, dates, and attachments.
- `AssetDisposal`: disposition details, authorization, date, and record of final state.

Represent lifecycle events as traceable records rather than overwriting the only evidence of prior ownership or condition.

### Network documentation

- `NetworkDevice`: organization, type, manufacturer/model/serial, management address, MAC where applicable, firmware/OS, location, owner/administrator, and operational status.
- `Subnet`: CIDR, gateway/DNS data, location, and organization-scoped uniqueness rules.
- `IPAddress`: address, subnet, assignment type, assigned device or other approved target, and conflict/availability state. Validate address family and subnet membership in application logic; enforce uniqueness where required.
- `VLAN`: organization, VLAN ID, name, purpose, subnet/device associations, and status.
- `NetworkConnection`: links two saved devices with connection details; both endpoints must belong to the same organization.
- `DeviceConfiguration`: version metadata, change description, actor, timestamp, and protected attachment/storage reference. Avoid keeping secrets in ordinary configuration records.
- `NetworkIncident`, `NetworkMaintenance`: incident and maintenance history related to devices/subnets/locations.

Device operational state must include provenance and timestamps. The initial release records manual updates only. Future monitoring observations should be separate records with collector/source and observed time rather than overwriting manual history.

### Shared operational data

- `KnowledgeArticle`, `KnowledgeArticleRevision`
- `Notification`, optional per-channel delivery attempt records
- `AuditLog`: actor, organization, action, target, timestamp, and carefully filtered metadata
- `SystemSetting`: organization/system configuration with sensitive values kept in secret storage, not plaintext settings

## File metadata

Store file bytes in local storage during development or S3-compatible object storage in production. PostgreSQL stores only metadata such as organization, uploader, ticket association where applicable, original filename, detected MIME type, size, checksum, opaque storage reference, and timestamps. Do not expose a storage key as an authorization mechanism; authorize each download through the API. Network backup attachments may be unlinked until referenced by a device configuration.

## Constraints and indexes to finalize in schema review

- Unique user email within the required identity scope.
- Unique role and permission names within their management scope.
- Unique asset tag per organization; serial-number uniqueness only if policy confirms it.
- Unique device address and IP allocation according to address-family and assignment rules.
- VLAN ID constraints and uniqueness within the organization or network scope.
- Application services validate organization ownership before cross-record references. The current schema does not use composite organization foreign keys throughout; full database-enforced tenant isolation is required before multi-organization support.
- Indexes supporting ticket queues, user-owned ticket history, asset search, device/IP lookup, and audit investigations.
- Check constraints for nonnegative file size/cost where applicable and valid lifecycle ranges.

## Reporting data

Calculate operational metrics from ticket status/assignment history and configured SLA policies. Before implementation, define business hours, holidays, pause conditions, response/resolution start and stop events, and treatment of reopened tickets. Avoid duplicate cached metrics until performance evidence justifies them.
