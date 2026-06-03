# Tahti Upptime (M11)

Self-hosted status page using [Upptime](https://github.com/upptime/upptime). Monitors the same surfaces as Grafana blackbox on vimage6; see [`../monitoring/vimage6/README.md`](../monitoring/vimage6/README.md).

## Monitored endpoints

| Monitor | URL | Expected |
|---------|-----|----------|
| API status | `{API_URL}/api/v1/status` | HTTP 200, JSON `status: ok` |
| API liveness | `{API_URL}/health` | HTTP 200 |
| Web app | `{APP_URL}/` | HTTP 200 |
| Transparency | `{APP_URL}/transparency` | HTTP 200 |

Set `API_URL` (e.g. `https://api.tahti.live`) and `APP_URL` (e.g. `https://app.tahti.live`) in your Upptime repo secrets or fork config.

## Quick start (fork Upptime template)

1. Fork [upptime/upptime](https://github.com/upptime/upptime) or use the template on your org.
2. Copy [`upptime.config.example.yml`](./upptime.config.example.yml) into the fork as `.upptimerc.yml` (or merge `sites` into your config).
3. Set GitHub Actions secrets: `API_URL`, `APP_URL` if using env substitution in CI.
4. Enable GitHub Pages on the Upptime repo for the public status site.

## API contract

`GET /api/v1/status` returns **503** when a critical dependency is down (Postgres). Upptime should treat only **200** as up. Response shape:

```json
{
  "status": "ok",
  "checks": { "postgres": { "state": "up", "critical": true }, ... }
}
```

## Related

- Backup age alerts: `./scripts/backup.sh status` (cron + exit codes)
- Prometheus: `ops/monitoring/vimage6/`
