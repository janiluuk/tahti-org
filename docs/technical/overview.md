# Tahti — technical overview

This directory contains technical documentation for each delivery phase, user journeys, and architecture diagrams. All diagrams use [Mermaid](https://mermaid.js.org/) and render in GitHub, GitLab, Notion, and most modern docs tools.

## Phase timeline

```mermaid
gantt
    title Tahti delivery phases
    dateFormat  YYYY-MM-DD
    axisFormat  %b %Y
    todayMarker off

    section Legal / Grants
    Phase 0 – Legal & grants          :p0, 2025-10-01, 90d

    section Infrastructure
    Phase 1 – Website live            :p1, 2026-01-01, 14d
    Phase 2 – Dev environment         :p2, 2026-01-08, 21d
    Phase 3 – Stateful services       :p3, 2026-02-01, 45d
    Phase 5 – Staging cluster         :p5, 2026-03-01, 30d

    section Product
    Phase 4 – Artist app alpha        :p4, 2026-02-15, 90d
    Phase 6 – Distribution & ledger   :p6, 2026-05-01, 120d
    Phase 7 – Hardening & launch      :p7, 2026-08-01, 45d
    Public launch                     :milestone, 2026-09-15, 0d
```

## Full production architecture

```mermaid
graph TB
    subgraph Internet
        A[Artist browser]
        L[Listener browser]
        OBS[OBS / Streamlabs]
        MX[Mixxx / Traktor / butt]
    end

    subgraph Edge ["Edge node — Helsinki (1 Gbps fiber)"]
        Caddy[Caddy 2\nTLS termination]
    end

    subgraph Workers ["Worker nodes × 2"]
        Website[website\nnginx static]
        Web[web\nNext.js]
        API[api\nFastify × 3]
        Chat[chat\nCentrifugo × 2]
        WM[worker-media\ntranscode × 2]
        WD[worker-dist\nRevelator / Mixcloud]
        WL[worker-light\nstats / cleanup]
        Orch[orchestrator]
        LS[Liquidsoap\n1 container / channel]
    end

    subgraph Ingest ["Ingest node"]
        RTMP[nginx-RTMP\n:1935]
        IC[Icecast\n:8000]
    end

    subgraph DB ["DB node"]
        PG[(Postgres 16)]
        RD[(Redis 7)]
        Prom[Prometheus]
        Graf[Grafana]
    end

    subgraph Storage ["Storage node"]
        MN[(MinIO\nobject store)]
    end

    subgraph UpCloud ["UpCloud Helsinki — spillover / DR"]
        UC[HLS mirror\n+ MinIO replica]
    end

    A -- HTTPS --> Caddy
    L -- HTTPS --> Caddy
    OBS -- RTMP :1935 --> RTMP
    MX -- Icecast :8000 --> IC

    Caddy --> Website
    Caddy --> Web
    Caddy --> API
    Caddy --> Chat
    Caddy -- /srv/hls --> HLS_vol[(hls_shared\nvolume)]

    API --> PG
    API --> RD
    API --> MN
    API --> Chat

    RTMP -- on_publish --> API
    IC -- URL auth --> API
    Orch -- docker API --> LS
    LS -- HLS output --> HLS_vol
    LS -- recordings --> Rec_vol[(recordings_shared)]

    WM --> PG
    WM --> RD
    WM --> MN
    WD -- HTTPS --> Revelator[(Revelator DSP)]
    WD -- HTTPS --> Mixcloud[(Mixcloud API)]

    PG --> UC
    MN --> UC

    Prom --> API
    Prom --> Chat
    Prom --> Caddy
    Graf --> Prom
```

## Service inventory

| Service | Image | Network | Role |
|---------|-------|---------|------|
| `website` | `registry.tahti.live/tahti/website` | edge | Marketing site at tahti.live |
| `web` | `registry.tahti.live/tahti/web` | internal + edge | Artist app at app.tahti.live + channel subdomains |
| `api` | `registry.tahti.live/tahti/api` | internal + edge | Fastify REST + webhook target |
| `chat` | `centrifugo/centrifugo:v5` | internal + edge | WebSocket hub for live chat |
| `worker-media` | `registry.tahti.live/tahti/worker` | internal | Transcode, archive, fingerprint |
| `worker-dist` | `registry.tahti.live/tahti/worker` | internal | Revelator DSP + Mixcloud upload |
| `worker-light` | `registry.tahti.live/tahti/worker` | internal | Stats rollup, chat cleanup |
| `orchestrator` | `registry.tahti.live/tahti/orchestrator` | internal | Spawns Liquidsoap per channel |
| `icecast` | `moul/icecast` | ingest + internal | Icecast source ingress |
| `rtmp-ingest` | `tiangolo/nginx-rtmp` | ingest + internal | OBS/RTMP ingress |
| `postgres` | `postgres:16-alpine` | internal | Primary database |
| `redis` | `redis:7-alpine` | internal | Sessions, queues, presence |
| `minio` | `minio/minio` | internal + edge | Object storage |
| `caddy` | `caddy:2-alpine` | edge | TLS proxy, HLS file server |
| `prometheus` | `prom/prometheus` | internal | Metrics scrape |
| `grafana` | `grafana/grafana` | internal + edge | Dashboards (ops-only) |

## Key port map

| External port | Protocol | Service |
|---------------|----------|---------|
| 80 / 443 | HTTPS | Caddy (all web traffic) |
| 1935 | RTMP | nginx-RTMP (OBS ingest) |
| 8000 | HTTP+Icecast | Icecast (Mixxx ingest) |

## Domain routing

```mermaid
graph LR
    DNS["DNS\ntahti.live"]

    DNS -- "tahti.live\nwww.tahti.live" --> website
    DNS -- "app.tahti.live" --> web
    DNS -- "*.tahti.live (channel slugs)" --> web
    DNS -- "api.tahti.live" --> api
    DNS -- "chat.tahti.live" --> chat
    DNS -- "stream.tahti.live" --> hls[HLS file server\nCaddy]
    DNS -- "cdn.tahti.live" --> minio
    DNS -- "ingest-icecast.tahti.live" --> icecast
    DNS -- "minio.tahti.live" --> minio_console[MinIO console\nops-IP only]
    DNS -- "grafana.tahti.live" --> grafana[Grafana\nops-IP only]
```

## Phase documents

| Phase | Doc | Goal |
|-------|-----|------|
| 1 | [phase-1.md](phase-1.md) | tahti.live live over HTTPS |
| 2 | [phase-2.md](phase-2.md) | `make dev` works; CI + registry |
| 3 | [phase-3.md](phase-3.md) | Postgres / Redis / MinIO in prod with backups |
| 4 | [phase-4.md](phase-4.md) | Artist app alpha — accounts, broadcast, archive |
| 5 | [phase-5.md](phase-5.md) | 3-node staging Swarm; auto-deploy pipeline |
| 6 | [phase-6.md](phase-6.md) | Distribution, transparency ledger, grants |
| 7 | [phase-7.md](phase-7.md) | Hardening, load test, public launch |

**Node placement & bottlenecks:** [scaling-node-distribution.md](../scaling-node-distribution.md) — Swarm labels, replica map, and what to scale when API, chat, transcode, DB, or egress saturates.

## User journey documents

| Perspective | Doc | Phases covered |
|-------------|-----|---------------|
| Artist | [journey-artist.md](journey-artist.md) | 1 → 7 |
| Listener | [journey-listener.md](journey-listener.md) | 4 → 7 |
| Ops engineer | [journey-ops.md](journey-ops.md) | 1 → 7 |
| Director / Board | [journey-director.md](journey-director.md) | 3 → 7 |
