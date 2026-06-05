# Tahti platform architecture

High-level topology for operators and developers. Service names match Docker Swarm
stack **`tahti`** in [`infra/docker-stack.yml`](../infra/docker-stack.yml).

## Production topology (Swarm)

```mermaid
flowchart TB
  subgraph internet [Internet]
    listeners[Listeners / artists]
    dns[DNS tahti.live]
  end

  subgraph edge [Edge node — Caddy]
    caddy[caddy]
    rtmp_a[rtmp-ingest]
    rtmp_b[rtmp-ingest-b]
    ice_a[icecast]
    ice_b[icecast-b]
  end

  subgraph internal [Internal overlay]
    web[web — Next.js]
    api[api — Fastify]
    chat_svc[chat — Centrifugo]
    orch[orchestrator — Liquidsoap]
    wm[worker-media]
    wd[worker-dist]
    wl[worker-light]
    wel[worker-edge-log]
    pg[(postgres)]
    redis[(redis)]
    minio[(minio)]
  end

  subgraph observability [Observability]
    prom[prometheus]
    graf[grafana]
  end

  listeners --> dns
  dns --> caddy
  caddy --> web
  caddy --> api
  caddy --> chat_svc
  listeners --> rtmp_a
  listeners --> rtmp_b
  listeners --> ice_a
  listeners --> ice_b

  web --> api
  api --> pg
  api --> redis
  api --> minio
  api --> chat_svc
  api --> orch
  wm --> pg
  wm --> redis
  wm --> minio
  wd --> pg
  wl --> pg
  wl --> redis
  orch --> minio
  orch --> ice_a
  orch --> ice_b
  prom --> api
  graf --> prom
```

## Live broadcast data flow

```mermaid
sequenceDiagram
  participant Artist as Artist encoder
  participant RTMP as rtmp-ingest / icecast
  participant Orch as orchestrator
  participant MinIO as MinIO
  participant API as api
  participant HLS as CDN / Caddy HLS

  Artist->>RTMP: RTMP or Icecast mount
  RTMP->>Orch: pull / relay
  Orch->>HLS: HLS segments
  Orch->>MinIO: recording + fingerprint samples
  Orch->>API: internal webhooks
  API->>MinIO: archive finalize
  HLS->>Artist: listeners play
```

## Backup & DR flow

```mermaid
flowchart LR
  pg[(postgres)] --> dump[backup.sh postgres]
  dump --> minio_p[(minio backups/pg)]
  minio_p --> mirror[backup.sh minio]
  mirror --> dr[(tahti-dr UpCloud)]
  restore[restore-test weekly] --> pg_throw[(throwaway DB)]
  minio_p --> restore
```

## Networks

| Overlay | Services | Exposure |
|---------|----------|----------|
| `edge` | caddy, rtmp-ingest*, icecast* | Public via host ports / DNS |
| `internal` | api, web, workers, postgres, redis, minio, orchestrator, chat | Private overlay only |
| `ingest` | ingest replicas | Between edge and orchestrator |

## Stateful volumes

| Volume | Holds |
|--------|--------|
| `postgres_data` | All application data |
| `minio_data` | Audio, covers, backup objects |
| `redis_data` | Sessions, rate limits, Tor exit cache |
| `hls_shared` / `recordings_shared` | Live pipeline scratch (orchestrator) |

## External dependencies

| Service | Purpose | Config |
|---------|---------|--------|
| Stripe | Membership, fan-subs, distribution fees | Secrets + webhooks |
| Mixcloud | Archive distribution OAuth | `MIXCLOUD_CLIENT_ID` + secret |
| Revelator | DSP submission stub/live | `revelator_api_key` secret |
| SMTP / Postmark / SES | Auth mail + newsletters | [`EMAIL.md`](EMAIL.md) |
| UpCloud | DR object storage | `tahti-dr` mc alias |

## Environments

| Env | Compose / stack | Ports / URL |
|-----|-----------------|-------------|
| Local dev | `docker compose` + `pnpm dev` | localhost |
| Lab stack | `scripts/stack-up.sh` | 3010 / 3011 |
| Production | Swarm `tahti` | `*.tahti.live` |

## Related

- [`RUNBOOK.md`](RUNBOOK.md) — operational procedures
- [`docs/technical/streaming-architecture.md`](../docs/technical/streaming-architecture.md) — ingest failover, fingerprints
- [`docs/technical/scaling-node-distribution.md`](../docs/technical/scaling-node-distribution.md) — horizontal scale notes
