# Tahti production secrets (Phase 0 / M0)

Docker Swarm **external secrets** are created once on the manager and referenced in
[`infra/docker-stack.yml`](../infra/docker-stack.yml). Values never belong in Git.

## Create secrets

Run on the Swarm manager (see header comments in `docker-stack.yml`):

```bash
echo -n "..." | docker secret create pg_password -
echo -n "..." | docker secret create minio_root_password -
openssl rand -base64 48 | docker secret create session_secret -
openssl rand -base64 32 | docker secret create rtmp_key_encryption_key -
openssl rand -base64 32 | docker secret create centrifugo_secret -
openssl rand -hex 32   | docker secret create chat_fingerprint_salt -
echo -n "..." | docker secret create revelator_api_key -
echo -n "..." | docker secret create mixcloud_client_secret -
echo -n "..." | docker secret create smtp_password -
echo -n "tahti" | docker secret create docs_user -
openssl rand -base64 24 | docker secret create docs_pass -
echo -n "$ACOUSTID_KEY" | docker secret create acoustid_api_key -
```

**Post-production only (ACRCloud track ID):**

```bash
echo -n "$KEY" | docker secret create acrcloud_access_key -
echo -n "$SECRET" | docker secret create acrcloud_access_secret -
# Then set ACRCLOUD_ENABLED=true on api and FINGERPRINT_SEND_AUDIO=1 on orchestrator.
```

## Non-secret configuration

Public or low-sensitivity values live in **`stack.env`** on the manager (see
[`infra/stack.env.example`](../infra/stack.env.example)): `MIXCLOUD_CLIENT_ID`,
`EMAIL_BOUNCE_WEBHOOK_SECRET`, ingest host lists, etc. The deploy workflow sources `stack.env` before
`docker stack deploy`.

## Rotation

| Secret | Procedure |
|--------|-----------|
| `docs_pass` | Create new secret, `docker service update --secret-rm/add` on `tahti_api` |
| `session_secret` | Rotate during maintenance; invalidates all sessions |
| `mixcloud_client_secret` | Update Mixcloud app + Swarm secret; redeploy api + worker-dist |
| Postgres | Change DB password + update `pg_password` secret + stack env |

Swagger and Mixcloud details: [`ops/RUNBOOK.md`](RUNBOOK.md).

## Related

- Backup / DR: [`RUNBOOK.md`](RUNBOOK.md), [`BACKUP.md`](BACKUP.md)
- Ingest DNS: [`ingest-dns.md`](ingest-dns.md)
