# User journey — Ops engineer

The ops engineer (initially the director or a volunteer contractor) is responsible for deploying, monitoring, and recovering the platform. This document covers the full ops lifecycle from first deploy to scaling decisions.

---

## Experience overview

```mermaid
journey
    title Ops engineer lifecycle
    section Phase 1–2 Setup
      Provisions VPS                         : 4 : Ops
      Deploys website via Makefile           : 5 : Ops
      Sets up CI pipeline                    : 4 : Ops
      Tests first auto-deploy                : 5 : Ops
    section Phase 3 Stateful
      Creates Docker secrets                 : 3 : Ops
      Deploys Postgres and MinIO             : 4 : Ops
      Runs first backup                      : 4 : Ops
      Restores from backup successfully      : 5 : Ops
    section Phase 4–5 App
      Deploys full stack                     : 4 : Ops
      Migrates database                      : 3 : Ops
      Monitors first live broadcast          : 4 : Ops
      Sets up Grafana dashboards             : 5 : Ops
    section Phase 7 Hardening
      Runs k6 load test                      : 4 : Ops
      Writes incident runbooks               : 3 : Ops
      Drills first simulated incident        : 4 : Ops
    section Launch and beyond
      Monitors launch day traffic            : 3 : Ops
      Handles first real incident            : 3 : Ops
      Scales a service under load            : 4 : Ops
```

---

## Journey 1 — First deploy (Phase 1)

```mermaid
sequenceDiagram
    participant Ops as Ops engineer
    participant VPS as VPS (UpCloud Helsinki)
    participant GH as GitHub
    participant Reg as registry.tahti.live
    participant DNS as DNS registrar

    Ops->>VPS: Provision 2 vCPU / 4 GB VPS in Helsinki
    Ops->>VPS: SSH root@<ip>
    Ops->>VPS: curl -fsSL https://get.docker.com | sh
    Ops->>VPS: docker swarm init
    Ops->>VPS: Label node with all roles
    Ops->>VPS: docker run -d --name registry -p 127.0.0.1:5000:5000 registry:2

    Ops->>GH: Push repo, add REGISTRY_PASSWORD + DEPLOY_SSH_KEY secrets
    Ops->>GH: Push a commit to main
    GH->>GH: Build website image
    GH->>Reg: Push tahti/website:<sha>
    GH->>VPS: SSH: TAG=<sha> docker compose up -d

    Ops->>DNS: Set A record tahti.live → VPS IP
    Ops->>VPS: curl -I https://tahti.live
    VPS-->>Ops: HTTP/2 200 — TLS active ✓
    Ops->>GH: Note in ops log: Phase 1 complete
```

---

## Journey 2 — Production deploy (rolling update)

**Daily routine once CI is set up.**

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub Actions
    participant Reg as registry.tahti.live
    participant STG as Staging Swarm
    participant ProdMgr as Production Swarm manager

    Dev->>GH: git push → PR merged to main
    GH->>GH: Build all images with SHA tag
    GH->>Reg: Push all images
    GH->>STG: Deploy to tahti-staging stack
    STG-->>GH: Smoke tests pass

    Note over GH: Staging green → staging is validated

    Dev->>GH: git tag v1.2.3 && git push --tags
    GH->>GH: Production deploy job triggered
    GH-->>Ops: GitHub environment approval request (email/Slack)

    Ops->>GH: Reviews diff (what's in this release)
    Ops->>GH: Approves deployment in GitHub UI

    GH->>ProdMgr: SSH: TAG=<sha> make deploy
    ProdMgr->>Reg: Pull new images
    ProdMgr->>ProdMgr: Rolling update (start-first order)
    ProdMgr-->>GH: All services updated ✓

    GH->>GH: Smoke test: curl https://tahti.live/health && curl https://api.tahti.live/health
    GH-->>Ops: ✓ v1.2.3 deployed to production
```

---

## Journey 3 — Incident response (Postgres down)

```mermaid
sequenceDiagram
    participant Alert as Prometheus alert
    participant Ops as Ops (on-call)
    participant Graf as Grafana
    participant VPS as Production VPS
    participant PG as Postgres

    Alert-->>Ops: PagerDuty/email: "postgres_down CRITICAL"
    Note over Ops: 02:30 local time

    Ops->>Graf: grafana.tahti.live → check postgres panel
    Graf-->>Ops: Postgres: no data since 02:22, connection errors visible

    Ops->>VPS: SSH root@tahti.live
    Ops->>VPS: docker stack ps tahti --filter desired-state=running
    VPS-->>Ops: tahti_postgres.1 → State: Failed, Error: OOM

    Ops->>VPS: docker service logs tahti_postgres --tail=50
    VPS-->>Ops: "Out of memory: kill process postgres"

    Note over Ops: DB node is memory-exhausted
    Ops->>VPS: docker stats --no-stream
    VPS-->>Ops: DB node: 100% RAM used (other services eating into shared memory)

    Ops->>VPS: docker service update --limit-memory 6G tahti_postgres
    VPS->>PG: Restart with new memory limit
    PG-->>VPS: Postgres healthy (pg_isready)

    Ops->>VPS: docker stack ps tahti | grep postgres
    VPS-->>Ops: Running 3/3 ✓

    Ops->>Graf: Grafana — verify API reconnected, error rate back to 0
    Ops->>Ops: Write incident log (cause, resolution, prevention)
    Ops->>Ops: File GitHub issue: "DB node needs dedicated memory budget"
```

---

## Journey 4 — Backup and restore verification

**Weekly automated + monthly manual drill.**

```mermaid
sequenceDiagram
    participant Cron as Weekly cron (Sunday 05:00)
    participant Script as backup.sh restore-test
    participant S3 as UpCloud bucket
    participant TMP as Temp postgres container
    participant Log as /var/log/tahti-restore-test.log

    Cron->>Script: Run /srv/tahti/scripts/backup.sh restore-test

    Script->>S3: mc ls tahti-backups/pg/ | tail -1 → get latest backup
    Script->>S3: mc get tahti-backups/pg/20260519-030000.sql.gz /tmp/latest.sql.gz

    Script->>TMP: docker run -d postgres:16-alpine (ephemeral, no volume)
    Script->>TMP: gunzip /tmp/latest.sql.gz | psql postgres://tahti@localhost:5433/tahti_test
    TMP-->>Script: Restore complete

    Script->>TMP: SELECT COUNT(*) FROM artists
    TMP-->>Script: 847

    Script->>Script: Compare to expected row count (stored in previous successful restore log)
    Script-->>Log: ✓ Restore verified: 847 artists (expected: 840–900)

    Script->>TMP: docker rm -f <temp-container>
    Script-->>Cron: Exit 0

    Note over Log: On failure: send email to ops@tahti.live
```

---

## Journey 5 — Scaling under load (launch day)

```mermaid
sequenceDiagram
    participant Ops as Ops engineer
    participant Graf as Grafana dashboard
    participant VPS as Swarm manager
    participant LB as Caddy load balancer

    Note over Ops: Launch day — traffic spike from press coverage
    Graf-->>Ops: Alert: api P95 latency 1200ms (threshold: 500ms)

    Ops->>Graf: Opens api-latency dashboard
    Graf-->>Ops: api: 3 replicas, all at 90% CPU, queue building

    Ops->>VPS: docker service scale tahti_api=5
    VPS-->>VPS: Schedules 2 new api replicas
    VPS-->>LB: Caddy discovers new upstreams automatically

    Note over Ops: Wait 60s for new replicas to be healthy
    Ops->>Graf: Checks API latency panel
    Graf-->>Ops: P95 back to 210ms ✓

    Ops->>Ops: Notes: "Launch day peaked at 5 api replicas needed"
    Ops->>Ops: Files issue: "Adjust default api replicas to 4 for next launch"
```

---

## Monitoring setup reference

```mermaid
graph LR
    subgraph "Metrics sources"
        API[api :3000/metrics]
        Chat[centrifugo :8000/metrics]
        Caddy[caddy :2019/metrics]
        PG_EX[postgres-exporter :9187]
        RD_EX[redis-exporter :9121]
    end

    subgraph "Prometheus"
        PROM[scrape every 15s]
    end

    subgraph "Grafana dashboards"
        D1[API latency + error rate]
        D2[Active listeners / channels]
        D3[Queue depths per worker]
        D4[Postgres connections + slow queries]
        D5[Redis memory + hit rate]
        D6[MinIO storage usage]
    end

    subgraph "Alerts (email + PagerDuty)"
        A1[api_down CRITICAL]
        A2[postgres_down CRITICAL]
        A3[api_p95_latency > 1000ms WARNING]
        A4[disk_used > 80% WARNING]
        A5[backup_age > 26h WARNING]
    end

    API & Chat & Caddy & PG_EX & RD_EX --> PROM
    PROM --> D1 & D2 & D3 & D4 & D5 & D6
    PROM --> A1 & A2 & A3 & A4 & A5
```

---

## Ops friction map

```mermaid
graph TB
    subgraph "High friction (needs process + tooling)"
        H1[Secret rotation\n— no UI, manual docker secret commands]
        H2[Multi-service log correlation\n— docker logs across services]
        H3[DB schema migration\n— manual trigger on deploy]
    end

    subgraph "Medium friction"
        M1[Staging vs prod config drift\n— override files help but still fragile]
        M2[Node provisioning\n— manual ssh + label assignment]
    end

    subgraph "Low friction (well automated)"
        L1[Website deploy\n— git push → CI → live in 3 min]
        L2[Service scaling\n— docker service scale]
        L3[Rollback\n— make rollback]
        L4[Health checking\n— docker stack ps]
    end

    H1 --> Fix1[Secret rotation script\n/srv/tahti/scripts/rotate-secrets.sh]
    H2 --> Fix2[Grafana Loki for centralised logs\nPhase 7 add-on]
    H3 --> Fix3[Migration step in CI pipeline\nbefore service update]
```

---

## Detailed steps (implemented today)

Deploy and incident journeys above describe the full ops lifecycle. **API-level smoke tests** validate what CI and on-call can curl without SSH:

| Journey | Step | Endpoint | E2e |
|---------|------|----------|-----|
| Monitoring | Liveness | `GET /health` | `ops.sh`, `vital-flows.sh`, Vitest |
| Monitoring | Dependency matrix | `GET /api/v1/status` | `ops.sh`, Vitest |
| Monitoring | Prometheus scrape | `GET /metrics` (`tahti_api_healthy`, uptime, backup age) | `ops.sh`, Vitest |
| Monitoring | OpenAPI | `GET /docs` | `ops.sh` |
| Incident | Postgres down | manual SSH + `docker service update` | runbook only |
| Backup drill | Restore test | `scripts/backup.sh restore-test` | manual / cron on prod |

Grafana dashboards and alert rules: `ops/monitoring/vimage6/`.

---

## Automated coverage

| Layer | Script / test |
|-------|----------------|
| CI bash | `tests/e2e/user-journeys.sh` → `journeys/ops.sh`; also `vital-flows.sh` health/status |
| Vitest | `persona-journeys.test.ts` (ops describe) |
| Index | [user-flows.md](../user-flows.md) |
