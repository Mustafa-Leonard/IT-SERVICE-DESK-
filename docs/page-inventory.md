# Portal and Page Inventory

## Count reconciliation

The approved audit request describes **51 required pages**, but the six role totals in the same request add up to **52**: Employee 9, Technician 9, Network Administrator 10, Asset Manager 8, IT Manager 7, and Super Administrator 9. This inventory preserves all six role totals and records 52 as the enumerated total. The individual page names from the long-form request were not retained in the available project/session summary, so the inventory below reports actual implemented routes and maps coverage to the approved role responsibilities rather than inventing a one-to-one name mapping.

## Implemented frontend routes

| Route | Current screen | Coverage |
| --- | --- | --- |
| `/` | Public landing page when signed out; shared operational overview when signed in | Partial; overview is shared rather than role-specific |
| `/login` | Organization sign-in and password-reset request mode | Implemented |
| `/admin/login` | Dedicated Super Administrator sign-in | Implemented; successful credential flow awaits an initialized admin account |
| `/activate` | Account activation/password setup | Implemented; SMTP delivery is not configured in this environment |
| `/reset-password` | Password reset completion | Implemented; SMTP delivery is not configured in this environment |
| `/health` | API/database health | Implemented |
| `/tickets` | Ticket list and create flow | Implemented; role-specific queue behavior depends on API permissions |
| `/tickets/:ticketId` | Ticket details, comments, assignment/status actions | Implemented; some operations are permission-gated |
| `/assets` | Asset registration and inventory listing | Partial; lifecycle operations are API-only |
| `/network` | Device inventory/manual status, subnet/IPAM, VLANs, saved connections with a graphical view, incidents, maintenance, configuration history/upload/download | Partial; full device/IPAM metadata editing remains incomplete |
| `/knowledge` | Knowledge article reading | Partial; authoring/revision management is API-only |
| `/notifications` | In-app notifications | Implemented |
| `/reports` | Operational and SLA reports | Implemented; SLA uses elapsed-minute targets |
| `/admin/dashboard` | Super Administrator navigation hub | Implemented; links to existing user, report, and health screens |
| `/admin/users` | User invitations, deactivation, role assignment | Partial; role/permission catalog editing is not represented |
| `*` | Not-found page | Implemented |

`/admin/*` routes require a signed-in user with the `super_admin` role. Unauthenticated access redirects to `/admin/login`; other authenticated roles are redirected to `/`.

## Role coverage against the approved responsibilities

| Interface | Required page count | Existing frontend coverage | Missing or incomplete work |
| --- | ---: | --- | --- |
| Employee / end user | 9 | Ticket list/detail and creation, knowledge reading, notifications, asset inventory entry point | Dedicated employee dashboard/profile, assigned-assets view, and complete personal ticket lifecycle are not separate workflows |
| IT Technician | 9 | Ticket list/detail, assignment/status/comment controls, knowledge reader | Separate technician queue/dashboard and incident, problem, change, maintenance, and knowledge-authoring screens are absent |
| Network Administrator | 10 | Network inventory and documentation workflows in one page, including saved-topology visualization and authorized backup download | Full device/IP metadata editing remains incomplete |
| IT Asset Manager | 8 | Asset registration and inventory list | Assignment/transfer/maintenance/repair/disposal UI and asset history are absent |
| IT Manager | 7 | Shared overview and real-record reports | Approval queue and management-specific dashboard/workload views are absent |
| Super Administrator | 9 | Dedicated login, dashboard, and basic user management | Role/permission editor, department/location UI, settings, audit/security views, integration status, and backup records UI are absent |

Counts describe the request's stated scope, not the number of implemented screens. Several existing screens serve multiple roles, so route count is not a substitute for portal completion.

## API-only workflow families

The backend exposes 96 route handlers across authentication, users/RBAC, departments/locations, tickets/SLA, notifications, assets, network records, knowledge, attachments, reports, operations/approvals, administration, and health. Important UI gaps despite API support include:

- User role/permission catalog management; departments and locations.
- Asset assignment/transfer/maintenance/disposal lifecycle.
- Service incidents, problems, changes, approvals, and maintenance.
- Knowledge authoring, revisions, and publishing.
- Admin audit logs and application settings.
- Full device/IPAM metadata editing.

Backend route availability does not establish that the six requested interfaces are complete. All protected calls still require authenticated, permission-scoped verification.
