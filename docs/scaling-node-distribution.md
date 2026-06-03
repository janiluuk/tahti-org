# Node distribution & scalable bottlenecks

How to place Tahti services across Swarm nodes so each **bottleneck scales independently**. Production layout is defined in [`infra/docker-stack.yml`](../infra/docker-stack.yml); local full stack is [`infra/docker-compose.stack.yml`](../infra/docker-compose.stack.yml) (single host, same logical roles).

---

## Node roles (Swarm labels)

| Label | Purpose | Scale pattern |
|-------|---------|---------------|
| `role=edge` | TLS, reverse proxy, HLS read from shared volume | **1 node** until egress > ~500 Mbps → CDN pull origin |
| `role=worker` | Stateless app tier: API, web, chat, workers, marketing site | **Add nodes + replicas** (primary horizontal scale) |
| `role=db` | Postgres, Redis, Prometheus, Grafana | **Vertical** first; then PgBouncer + read replica |
| `role=storage` | MinIO (archive, covers, recordings) | **Vertical + disk**; later distributed MinIO |
| `role=ingest` | RTMP + Icecast (host ports 1935 / 8000) | **1 node** per ingest path; split RTMP vs Icecast if saturated |
| `manager` | Swarm control + **orchestrator** (Docker socket) | **1 manager**; orchestrator stays singleton |

```bash
docker node update --label-add role=edge     <edge-host>
docker node update --label-add role=worker   <worker-01>
docker node update --label-add role=worker   <worker-02>
docker node update --label-add role=db       <db-host>
docker node update --label-add role=storage  <storage-host>
docker node update --label-add role=ingest   <ingest-host>
```

---

## Physical distribution (production target)

```mermaid
flowchart TB
  subgraph Internet
    listeners[Listeners / browsers]
    artists[Artists OBS / Mixxx]
  end

  subgraph edge_node["edge — Caddy :80/:443"]
    caddy[Caddy]
  end

  subgraph ingest_node["ingest — host networking"]
    rtmp[nginx-RTMP :1935]
    ice[Icecast :8000]
  end

  subgraph worker_nodes["worker × N — stateless replicas"]
    direction TB
    api[api ×3]
    web[web ×2]
    chat[chat ×2]
    wm[worker-media ×2]
    wd[worker-dist ×1]
    wl[worker-light ×1]
    site[website ×2]
  end

  subgraph db_node["db — single-writer data plane"]
    pg[(Postgres)]
    redis[(Redis)]
    prom[Prometheus]
    graf[Grafana]
  end

  subgraph storage_node["storage — NVMe"]
    minio[(MinIO)]
  end

  subgraph manager_node["manager"]
    orch[orchestrator]
    ls1[Liquidsoap channel A]
    ls2[Liquidsoap channel B]
  end

  listeners -->|HTTPS| caddy
  caddy --> web
  caddy --> api
  caddy --> chat
  caddy -->|HLS segments| rtmp
  artists -->|RTMP| rtmp
  artists -->|Icecast| ice

  web --> api
  api --> pg
  api --> redis
  api --> minio
  chat --> redis
  wm --> redis
  wm --> minio
  wm --> pg
  wd --> redis
  wl --> redis

  rtmp -->|on_publish callbacks| api
  ice --> api
  orch -->|spawns| ls1
  orch -->|spawns| ls2
  ls1 --> minio
  ls2 --> minio
  api --> orch
```

**Rule:** anything that holds **sessions, queues, or truth** stays on `db` / `storage`; anything that only **transforms or serves** scales on `worker`.

---

## Bottleneck map → what to scale

```mermaid
flowchart LR
  subgraph bottlenecks["Pressure points"]
    B1[HTTP API latency]
    B2[SSR / dashboard load]
    B3[WebSocket chat fanout]
    B4[Transcode queue depth]
    B5[DB connections / writes]
    B6[Object storage I/O]
    B7[Live ingest bandwidth]
    B8[HLS egress bandwidth]
    B9[Per-channel encode CPU]
  end

  subgraph scale_actions["Scale lever"]
    S1[api replicas on worker nodes]
    S2[web replicas]
    S3[chat replicas + Redis backplane]
    S4[worker-media replicas + CPU]
    S5[PgBouncer + PG vertical / replica]
    S6[MinIO disk / distributed MinIO]
    S7[ingest node uplink or second ingest node]
    S8[CDN pull from MinIO / edge offload]
    S9[orchestrator spawns more LS containers on workers]
  end

  B1 --> S1
  B2 --> S2
  B3 --> S3
  B4 --> S4
  B5 --> S5
  B6 --> S6
  B7 --> S7
  B8 --> S8
  B9 --> S9
```

| Signal | Hot service | Node / action | Stack change |
|--------|-------------|---------------|--------------|
| API P95 > 500 ms | `api` | Add `role=worker` node; `replicas: 4+` | `docker service scale tahti_api=4` |
| Dashboard TTFB high | `web` | Same worker pool; `web` replicas 3+ | Stateless; `INTERNAL_API_BASE` → overlay `api` |
| Chat lag / 500+ WS | `chat` | Worker nodes; `chat` replicas 3+ | Redis must be backplane (already on `db`) |
| BullMQ `transcode-archive` depth > 50 | `worker-media` | Dedicated worker node, 4 CPU | `--queues=transcode-archive,record-live,fingerprint` only |
| Mixcloud/Revelator backlog | `worker-dist` | Scale replicas 2+ on worker | IO-bound to external APIs |
| PG connections > 80% max | `postgres` | **PgBouncer** on `db`; API → pooler | Do not scale API without pooler |
| MinIO disk > 70% | `minio` | `role=storage` bigger NVMe or 2nd storage node | Distributed erasure later |
| Caddy egress > 500 Mbps | `caddy` + HLS | CDN origin = MinIO; edge thin | See `docs/cdn-strategy.md` |
| RTMP disconnects under load | `rtmp-ingest` | Second ingest node (label `ingest`) | Host mode ports → one service per node |
| Many simultaneous live channels | Liquidsoap pods | More worker RAM/CPU; orchestrator on manager | Orchestrator uses Docker socket |

---

## Replica placement (current production defaults)

Spread replicas across **all** nodes with `role=worker` so Swarm anti-affinity keeps failure domains separate:

| Service | Replicas | Placement | Bottleneck type |
|---------|----------|-----------|-----------------|
| `api` | 3 | `worker` | CPU + DB pool |
| `web` | 2 | `worker` | CPU + API calls |
| `chat` | 2 | `worker` | WS + Redis |
| `worker-media` | 2 | `worker` | CPU (ffmpeg) + MinIO |
| `worker-dist` | 1 | `worker` | External API rate limits |
| `worker-light` | 1 | `worker` | Cron / rollup |
| `website` | 2 | `worker` | Static |
| `postgres` | 1 | `db` | **Do not** multi-replica without HA design |
| `redis` | 1 | `db` | Queue + chat; Sentinel later if needed |
| `minio` | 1 | `storage` | Disk throughput |
| `caddy` | 1 | `edge` | Network egress |
| `rtmp-ingest` / `icecast` | 1 each | `ingest` | Host ports, uplink |
| `orchestrator` | 1 | `manager` | Docker API + spawn LS |

---

## Traffic lanes (what must not share a bottleneck)

```mermaid
flowchart TB
  subgraph lane_a["Lane A — Interactive HTTP"]
    A1[Caddy] --> A2[web / api]
    A2 --> A3[(Postgres)]
    A2 --> A4[(Redis sessions)]
  end

  subgraph lane_b["Lane B — Real-time"]
    B1[Caddy] --> B2[Centrifugo chat]
    B2 --> B3[(Redis pub/sub)]
  end

  subgraph lane_c["Lane C — Live ingest"]
    C1[RTMP / Icecast] --> C2[api callbacks]
    C2 --> C3[orchestrator]
    C3 --> C4[Liquidsoap per channel]
  end

  subgraph lane_d["Lane D — Heavy async"]
    D1[worker-media] --> D2[(Redis queues)]
    D1 --> D3[(MinIO)]
    D1 --> D4[(Postgres metadata)]
  end

  subgraph lane_e["Lane E — Egress"]
    E1[Listeners] --> E2[Caddy HLS / CDN]
    E2 --> E3[(MinIO origin)]
  end
```

- **Lane A** scales with `api` + `web` on workers; protect **Lane A** from **Lane D** by never running ffmpeg on API containers.
- **Lane C** is **ingest-node + manager** bound; do not colocate ingest with `worker-media` at high broadcast count.
- **Lane E** is the first **fiber/CDN** bottleneck; scaling API replicas does not help listener playback.

---

## Growth phases (node count)

```mermaid
flowchart LR
  P0["Phase 0\n1 host\ncompose stack"] --> P1["Phase 1\n3 nodes\nedge + worker + db/storage"]
  P1 --> P2["Phase 2\n5 nodes\n+ ingest + 2nd worker"]
  P2 --> P3["Phase 3\nCDN origin\nPgBouncer\nworker-media ×3"]
```

| Phase | Nodes | When |
|-------|-------|------|
| **0 — Dev** | Single machine (`stack-up.sh`) | Local screenshots, integration |
| **1 — Launch** | 3: edge, worker, db+storage combined | < 100 concurrent listeners |
| **2 — Growth** | + ingest, + worker #2 | API P95 or transcode queue rises |
| **3 — Scale** | Dedicated storage; CDN; PgBouncer | Egress or PG connections cap |

---

## Local Docker stack vs Swarm

| Concern | `docker-compose.stack.yml` | Production Swarm |
|---------|---------------------------|------------------|
| Node split | All services on one host | Labels enforce separation |
| Ports | `3010` / `3011` (avoid host conflicts) | 443 via Caddy |
| Orchestrator | Docker socket on same host | Manager only |
| Scale test | Not representative of egress | Use staging + `k6` per `docs/delivery-phases.md` |

---

## Related docs

- Swarm topology (phase 5): [`docs/technical/phase-5.md`](technical/phase-5.md)
- Scaling triggers table: [`docs/delivery-phases.md`](delivery-phases.md#scaling-reference)
- Infra ownership: [`docs/infra-strategy.md`](infra-strategy.md)
- CDN offload path: [`docs/cdn-strategy.md`](cdn-strategy.md)
- User-facing routes / screenshots: [`docs/user-flows.md`](user-flows.md)
