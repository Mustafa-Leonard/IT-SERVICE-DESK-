# Backend

NestJS REST API and Prisma database layer. The main project setup, environment variables, Docker commands, and verification scripts are documented in the root [README](../README.md).

The API uses the `/api/v1` prefix. Swagger UI is available at `/api/docs`; the readiness endpoint is `/api/v1/health` and checks PostgreSQL connectivity.

Database changes must be made through Prisma migrations. From the project root, use `npm run db:migrate` for local development and `npm run db:deploy` for deployment migrations. The containerized production migration step is documented in the root [README](../README.md). Do not use `prisma db push` for managed environments.
