# PgBouncer (PLAT-003)

Connection pooler in front of Postgres before scaling `api` / worker replicas.

## Lab stack (`docker-compose.stack.yml`)

PgBouncer runs on port **6432** inside the stack. App services use:

```text
postgresql://tahti:tahti_dev@pgbouncer:6432/tahti?pgbouncer=true
```

The `db-push` one-shot job connects **directly** to `postgres:5432` (migrations must not use transaction pooling).

Enable host debugging (optional):

```bash
PGBOUNCER_PORT=16432 docker compose -f infra/docker-compose.stack.yml up -d pgbouncer
psql "postgresql://tahti:tahti_dev@localhost:16432/tahti"
```

## Production Swarm

`infra/docker-stack.yml` includes a `pgbouncer` service on the `db` node. App services connect via:

```text
postgres://tahti@pgbouncer:6432/tahti?pgbouncer=true
```

Password is read from the `pg_password` Docker secret at container start.

**Migrations** must bypass the pooler — use direct Postgres when running `db-migrate-deploy.sh`:

```bash
DATABASE_URL='postgres://tahti:<password>@postgres:5432/tahti' ./scripts/db-migrate-deploy.sh --image
```

After deploy, verify pooler health: `docker service ps tahti_pgbouncer` and API `/health` (postgres check goes through pooler).
