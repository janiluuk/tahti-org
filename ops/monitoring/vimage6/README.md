# Tahti monitoring (monitor.dudeisland.eu / vimage6)

Prometheus + Grafana on **192.168.2.105** (`vimage6`, public **monitor.dudeisland.eu**) scrape the **lab stack on vimage** (`192.168.2.100`).

Layout mirrors **Giggi overview** (`giggi-overview` dashboard): registered users, daily active users, host load average, HTTP errors, and response times.

## Deploy

```bash
./ops/monitoring/vimage6/deploy.sh
```

Optional override:

```bash
MONITORING_HOST=jani@192.168.2.105 ./ops/monitoring/vimage6/deploy.sh
```

Installs:

- Grafana dashboards **Tahti — lab overview** (`uid: tahti-overview`) and **Tahti vital services** (`uid: tahti-vital-services`)
- Blackbox exporter on `:9115` (host network)
- Prometheus jobs `tahti_api_metrics` and `tahti_blackbox` (appended once; marker `tahti-vital-services`)

After changing blackbox targets (e.g. web port), edit `prometheus-tahti.snippet.yml` on the server or remove the marker block and re-run deploy.

## API surfaces (lab)

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness; `200` if Postgres up, `degraded` if non-critical deps down |
| `GET /api/v1/status` | Rich JSON for Upptime / external monitors |
| `GET /metrics` | Prometheus: deps, users, HTTP counters, Stripe webhook failures |

### Platform gauges (`/metrics`)

| Metric | Meaning |
|--------|---------|
| `tahti_users_registered_total` | All user accounts |
| `tahti_users_active_today` | Distinct users with a session since UTC midnight |
| `tahti_audit_errors_24h` | Webhook/fraud audit rows in last 24h |
| `tahti_http_requests_total{status_class}` | Request counts since process start |
| `tahti_http_request_duration_ms_*` | Sum/count for average response time in Grafana |

## Blackbox probes

From vimage6 → vimage: API health/status, web `:7000`, website `:8090`, Centrifugo `:8000`, MinIO, orchestrator `:3003`, Icecast `:8100`.

## Host metrics

`job=node` already scrapes `192.168.2.100:9100` with `instance=vimage` (load average panels use `node_load1`).

## Grafana

Open **monitor.dudeisland.eu** (or Grafana on vimage6) → **Dashboards**:

- **Tahti — lab overview** — users, load, errors, latency (Giggi-style)
- **Tahti vital services** — dependency + probe detail

Datasource UID `P501B54A0D5548634` must match the local Prometheus datasource.

If `tahti_api_metrics` is **down**, start the lab stack on vimage:

```bash
ssh root@192.168.2.100
cd /srv/tahti
export WEB_PORT=7000 API_PORT=3011
./scripts/stack-up.sh
```

Or from your workstation: `WEB_PORT=7000 make stack-deploy` (rsync + remote `stack-up.sh`).

The web UI must listen on **7000** — blackbox probes `http://192.168.2.100:7000/`. Local `./scripts/stack-up.sh` defaults to **7777** to avoid host port clashes.
