# Tahti monitoring on vimage6

Prometheus + Grafana on **192.168.2.105** (`vimage6`) scrape the **lab stack on vimage** (`192.168.2.100`).

## Deploy

```bash
./ops/monitoring/vimage6/deploy.sh
```

Installs:

- Grafana dashboards **Tahti vital services** (`uid: tahti-vital-services`) and **Tahti — lab overview** (`uid: tahti-overview`)
- Blackbox exporter on `:9115` (host network)
- Prometheus jobs `tahti_api_metrics` and `tahti_blackbox` (appended once; marker `tahti-vital-services`)
- Prometheus alert rules `prometheus-tahti-alerts.yml` (backup age WARN >26h, critical >48h)

## API surfaces (lab)

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness; `200` if Postgres up, `degraded` if non-critical deps down |
| `GET /api/v1/status` | Rich JSON for Upptime / external monitors |
| `GET /metrics` | Prometheus gauges: `tahti_dependency_up`, `tahti_api_healthy`, latencies, **`tahti_postgres_backup_age_hours`** |

## Blackbox probes

From vimage6 → vimage: API health/status, web `:3010`, website `:8090`, Centrifugo `:8000`, MinIO, orchestrator `:3003`, Icecast `:8100`.

## Grafana

Open Grafana on vimage6 → **Dashboards** → **Tahti vital services** or **Tahti — lab overview**. Datasource UID `P501B54A0D5548634` must match the local Prometheus datasource.

If `tahti_api_metrics` is **down**, start the lab stack on vimage (`docker compose -f docker-compose.stack.yml up`).
