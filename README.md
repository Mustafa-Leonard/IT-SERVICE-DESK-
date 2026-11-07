# IT Service Desk & Network Asset Management System

Single-organization IT operations platform with initial identity, ticket, asset, network documentation, knowledge, notification, reporting, and administration workflows. Several workflows and release checks remain incomplete; see the [roadmap](docs/roadmap.md) before deployment.

## Technology

- Frontend: React, TypeScript, Vite, React Router, React Hook Form, Zod, TanStack Query, and Lucide.
- API: NestJS, TypeScript, REST, DTO validation, and Swagger.
- Database: PostgreSQL and Prisma migrations.
- Local services: Docker Compose.

## Local development

Requirements: Node.js 22 or newer, npm, and Docker Desktop/Engine.

1. Copy `.env.example` to `.env` and set a strong local `POSTGRES_PASSWORD`. Keep `.env` private.
2. Install dependencies:

   ```powershell
   npm.cmd --prefix backend ci
   npm.cmd --prefix frontend ci
   ```

3. Start PostgreSQL:

   ```powershell
   docker compose up -d database
   ```

4. Generate the Prisma client and apply development migrations:

   ```powershell
   npm.cmd run db:generate
   npm.cmd run db:migrate
   ```

5. In separate terminals, start the API and frontend:

   ```powershell
   npm.cmd --prefix backend run start:dev
   npm.cmd --prefix frontend run dev
   ```

The frontend is at `http://localhost:5173`, the API health endpoint is `http://localhost:3000/api/v1/health`, and Swagger UI is at `http://localhost:3000/api/docs`.

The initial Super Administrator is created with the secure bootstrap command. Set `ORGANIZATION_NAME`, `ORGANIZATION_SLUG`, `ADMIN_EMAIL`, `ADMIN_DISPLAY_NAME`, and `ADMIN_PASSWORD` in the ignored root `.env` or a secure process environment, then run `npm.cmd run admin:bootstrap` from `backend`. Use a unique password with at least 16 characters. A matching completed bootstrap is a no-op; mismatched or partial initialized states are refused. Never commit `.env` or use development placeholders in deployment.

Sign in at `http://localhost:5173`. Activation and password reset require SMTP; when SMTP is not configured, those actions return an explicit service-unavailable error. The health page reports actual API/database readiness. Network statuses are manually recorded, not live monitoring.

## Checks

From the project root:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
```

## Docker deployment

The default `docker-compose.yml` is for development and binds PostgreSQL only to localhost. Production deployment uses `docker-compose.production.yml`; PostgreSQL has no published host port, while the web container is bound to loopback for an HTTPS reverse proxy on the host. Review [docs/architecture.md](docs/architecture.md) and [docs/roadmap.md](docs/roadmap.md) before production use.

Production secrets, SMTP credentials, object-storage credentials, domain configuration, backup retention, and TLS certificates must be supplied by the operator. They are never committed. Run Prisma migrations as an explicit deployment step before starting the new application version:

```powershell
docker compose --profile operations -f docker-compose.production.yml run --rm migrate
docker compose -f docker-compose.production.yml up -d --build
```

See [docs/deployment.md](docs/deployment.md) for the production checklist and database backup/restore commands. The full-schema initial migration has been generated, but it has not yet been applied to a clean PostgreSQL instance. Production deployment, backup, and restoration procedures must be validated against the target server before relying on them; do not deploy until those checks pass.
