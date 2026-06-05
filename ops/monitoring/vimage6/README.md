# Tahti monitoring on vimage6

Prometheus + Grafana on **192.168.2.105** (`vimage6`) scrape the **lab stack on vimage** (`192.168.2.100`) and public `*.tahti.live` endpoints.

## Deploy

```bash
./ops/monitoring/vimage6/deploy.sh
```

Installs / updates:

| Asset | Purpose |
|-------|---------|
| **Tahti — infrastructure & services** (`uid: tahti-infrastructure`) | Host UP, CPU, memory, disk, network, disk I/O, Tahti containers, lab + public probes, SMTP |
| **Tahti vital services** (`uid: tahti-vital-services`) | API health, dependencies, blackbox probes |
| **Tahti — lab overview** (`uid: tahti-overview`) | App metrics, users, Stripe counters |
| Blackbox exporter `:9115` | HTTP/TCP probes |
| Prometheus jobs | `tahti_api_metrics`, `tahti_blackbox`, `tahti_blackbox_public`, `tahti_blackbox_tcp` |
| Alert rules | Postgres backup age (WARN >26h, critical >48h) |

The deploy script **replaces** the managed Prometheus snippet on each run (marker `tahti-vital-services`).

## Lab stack ports (vimage)

| Service | Port | Probe |
|---------|------|-------|
| API | `15011` | `/health`, `/metrics`, `/api/v1/status` |
| Web | `17777` | `/` |
| Website | `8090` | `/health` |
| Centrifugo | `18000` | `/health` |
| MinIO | `19000` | `/minio/health/live` |
| Orchestrator | `15003` | `/health` |
| Icecast | `18100` | `/status-json.xsl` |

## Public probes (blackbox from vimage6)

`https://api.tahti.live/health`, `app`, `tahti.live`, `chat`, `webmail`, `grafana`, and TCP `mail.tahti.live:587`.

## Host metrics

Existing Prometheus jobs on vimage6 already scrape **node_exporter**, **cAdvisor**, and **docker-catalog** on:

`vimage`, `vimage2`–`vimage5`, `vimage6`, `pi4`, `pi5`, `web`

The infrastructure dashboard surfaces CPU, load, memory, disk free/used, disk I/O, and network for all of these.

## Grafana

Open Grafana on vimage6 (`http://192.168.2.105:3000` or `grafana.tahti.live`) → **Dashboards** → **Tahti — infrastructure & services**.

Datasource UID `P501B54A0D5548634` must match the local Prometheus datasource.

Regenerate the infrastructure dashboard JSON after editing the generator:

```bash
python3 ops/monitoring/vimage6/generate-tahti-infrastructure-dashboard.py
```
