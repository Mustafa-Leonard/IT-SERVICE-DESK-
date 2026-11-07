# Deployment and recovery

This guide describes the intended Linux VPS/private-server deployment. Local Docker PostgreSQL startup and migration deployment have been exercised; production runtime and backup restoration have not. Treat the procedures below as operator steps to rehearse in a non-production environment before use.

## Production prerequisites

- Docker Engine and the Compose plugin on a supported Linux host.
- A reverse proxy with an HTTPS certificate. The frontend is bound to `127.0.0.1:${WEB_PORT:-8080}`; proxy HTTPS traffic to it.
- A private PostgreSQL network. The production Compose file does not publish the database port.
- S3-compatible private bucket, region, credentials (or an instance role), and an operator-defined object retention/versioning/backup policy.
- SMTP credentials for account activation and password-reset email.
- A production `.env` file with strong generated secrets and correct public URLs. Store it with restrictive permissions and outside source control.

At minimum configure `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL_DOCKER`, `JWT_ACCESS_SECRET` (at least 32 random bytes), `FRONTEND_ORIGIN` (HTTPS), `PUBLIC_APP_URL` (HTTPS), `S3_BUCKET`, `S3_REGION`, and SMTP settings. If using static S3 credentials, supply both `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`. Never use `.env.example` values in production.

The API rejects production configuration that uses local file storage or non-HTTPS public URLs. The S3 bucket must remain private; object access is mediated by the API.

## Initial deployment

1. Copy the production environment template from the operator's secret store and review every value.
2. Start the database and verify its health. It is attached only to the private Compose network.
3. Apply migrations explicitly:

   ```sh
   docker compose -f docker-compose.production.yml up -d database
   docker compose --profile operations -f docker-compose.production.yml run --rm migrate
   ```

4. Create the initial organization and Super Administrator. Inject the following values into the shell from a secret manager; do not put the password in shell history or a committed file:

   ```sh
   export ORGANIZATION_NAME='Your organization'
   export ORGANIZATION_SLUG='your-organization'
   export ADMIN_EMAIL='admin@example.org'
   export ADMIN_DISPLAY_NAME='Initial administrator'
   read -rs ADMIN_PASSWORD
   export ADMIN_PASSWORD
   docker compose --profile operations -f docker-compose.production.yml run --rm bootstrap
   unset ADMIN_PASSWORD
   ```

   Use a unique password with at least 16 characters. Repeating the command for the same completed organization/admin is a no-op; mismatched or partial initialized states are refused.

5. Start the application:

   ```sh
   docker compose -f docker-compose.production.yml up -d --build
   ```

6. Confirm `https://your-domain/api/v1/health`, sign in, and verify SMTP and S3 actions using non-sensitive test data. Review container logs for errors; do not log secrets or file content.

Do not deploy the current workspace until the full production Compose stack, authenticated workflows, provider integrations, backup restoration, HTTPS routing, and rollback procedures have been verified.

## Upgrades and rollback

1. Take a verified database backup and ensure the S3 object backup/versioning policy is current.
2. Build and review the release images.
3. Apply the migration as a separate step, then replace the application containers.
4. Verify health, login, ticket and attachment access, and logs.
5. Prisma migrations are forward-only by default. If a release fails, restore the pre-upgrade backup and matching object data or deploy a compatible code fix; do not assume an application image rollback reverses a database migration.

## Database backup

Run backups from a trusted host with access to the Docker socket. Create the backup directory with restrictive permissions. The dump contains sensitive organizational data; encrypt it at rest and copy it to a separate protected location.

```sh
umask 077
mkdir -p backups
docker compose -f docker-compose.production.yml exec -T database \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "backups/itdesk-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Database dumps do not contain S3 object contents. Configure S3 versioning or a separate protected backup process and periodically reconcile database attachment metadata with stored objects. Define and test backup retention and encryption with the organization.

## Restore rehearsal

Restore into a separate, isolated database first. Do not overwrite production during a rehearsal.

```sh
cat backups/itdesk-YYYYMMDDTHHMMSSZ.dump | \
  docker compose -f docker-compose.production.yml exec -T database \
  pg_restore --no-owner --clean --if-exists \
    -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

For a production recovery, stop application writes, confirm the exact target database and backup, restore matching object storage data, run health and consistency checks, then resume traffic. The command above modifies the selected database and must not be used until the target is positively verified.

## Operational controls still required

- Rehearse database and object-storage restore; define RPO/RTO, encryption, offsite copies, and retention.
- Add malware scanning and retention/deletion policy before production file uploads.
- Confirm proxy trust/network boundaries, TLS renewal, rate limits, and alerting.
- Configure SMTP delivery monitoring and an account-recovery procedure for SMTP outages.
- Define log retention and protect backups, environment files, and S3 configuration.
