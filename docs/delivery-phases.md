# Tahti — delivery phases

Practical engineering phases for taking the platform from a local repo to a live service. Each phase has a clear entry state, exit criteria, and hands-on steps. Do not start Phase N+1 until Phase N exits cleanly.

---

## Phase 1 — Website live (Week 1–2)

**Goal:** tahti.live serves the marketing site over HTTPS with no manual steps after `git push`.

**Entry state:** domain registered, single VPS provisioned (UpCloud / Hetzner, 2 vCPU / 4 GB).

### Steps

| # | Action | Command / note |
|---|--------|----------------|
| 1 | Install Docker Engine on the VPS | `curl -fsSL https://get.docker.com \| sh` |
| 2 | Init single-node Swarm | `docker swarm init` |
| 3 | Label the node as all roles | `docker node update --label-add role=worker --label-add role=edge --label-add role=db --label-add role=storage --label-add role=ingest $(docker info -f '{{.Swarm.NodeID}}')` |
| 4 | Build website image locally | `make build-website TAG=init` |
| 5 | Push to registry (or load directly for now) | `docker save … \| ssh host docker load` |
| 6 | Deploy minimal stack (website + caddy only) | `TAG=init docker stack deploy -c infra/docker-stack-website-only.yml tahti` |
| 7 | Point DNS A record for `tahti.live` + `www.tahti.live` → VPS IP | Traficom / DNS provider |
| 8 | Verify Caddy auto-TLS works | `curl -I https://tahti.live` → 200 |

**Exit criteria:**
- `https://tahti.live` loads the marketing page with a valid Let's Encrypt cert.
- Response time < 300 ms from Helsinki on uncached hit.

**Blocker if skipped:** visitors see a broken domain. Marketing and grant applications reference tahti.live — ship this first.

---

## Phase 2 — Dev environment ready (Week 2–4)

**Goal:** any developer can clone the repo, run `make dev`, and have all infra up in under 2 minutes.

### Steps

| # | Action | Note |
|---|--------|------|
| 1 | Verify `make dev` starts all services cleanly | postgres, redis, minio, chat, icecast, rtmp-ingest, mailhog, website |
| 2 | Write `api/.env.dev.example` with all env vars documented | API not containerised in dev — runs on host with `pnpm dev` |
| 3 | Write `web/.env.dev.example` | Next.js public vars |
| 4 | Add `.gitignore` entries for `infra/stack.env` and all `*.env` files | Prevent accidental secret commits |
| 5 | Set up self-hosted container registry on the manager VPS | `docker run -d -p 5000:5000 --restart=always --name registry registry:2` then proxy via Caddy at `registry.tahti.live` |
| 6 | Add GitHub Actions workflow for website CI | `.github/workflows/website.yml` — build, push to `registry.tahti.live` on merge to main |
| 7 | Smoke-test: `make build-website && make push && make deploy TAG=<sha>` | Verify website redeploys in < 30 s |

**Exit criteria:**
- `make dev` runs with no errors on a clean Ubuntu 24.04 machine.
- A `git push` to main automatically builds + pushes the website image and triggers `make deploy`.

---

## Phase 3 — Stateful services in production (Month 1–2)

**Goal:** Postgres, Redis, MinIO running on the Swarm with data persistence, backups, and secrets properly set.

### Steps

| # | Action | Note |
|---|--------|------|
| 1 | Create all Docker secrets | See `docker-stack.yml` header comments |
| 2 | Deploy full stack | `make deploy TAG=latest` |
| 3 | Verify Postgres is healthy | `docker exec $(docker ps -qf name=tahti_postgres) pg_isready -U tahti` |
| 4 | Set up daily Postgres backup to MinIO | Cronjob: `pg_dump \| gzip \| mc pipe tahti/backups/pg/$(date +%Y%m%d).sql.gz` |
| 5 | Set up MinIO bucket lifecycle policy | Archive uploads to cold storage after 90 days |
| 6 | Verify MinIO is reachable at `cdn.tahti.live` (behind Caddy) | `curl -I https://cdn.tahti.live/minio/health/live` |
| 7 | Set up offsite backup (rclone to Backblaze B2 or UpCloud Object Storage) | Run weekly from a cron on the manager |
| 8 | Test restore from backup | Spin up a throwaway postgres container, restore, verify row counts |

**Exit criteria:**
- All secrets are in Swarm, no plaintext credentials on disk.
- Daily Postgres backup lands in MinIO and is confirmed restorable.
- `docker stack ps tahti` shows no failed replicas.

---

## Phase 4 — API + artist app alpha (Month 2–5)

**Goal:** a hand-recruited artist can sign up, create a channel, and broadcast a live stream that listeners can hear.

This phase corresponds to milestones M0–M5 in `docs/AGENT.md`.

### Sub-phases

**4a — Skeleton + accounts (M0–M1)**
- API and Next.js web containerised with their Dockerfiles
- Artist registration, login, channel creation working
- `make deploy` ships all five app images (website, api, web, worker, orchestrator)
- Smoke test: sign up at `app.tahti.live`, create a channel

**4b — Archive uploads (M2)**
- MinIO buckets created (`audio`, `covers`, `waveforms`)
- Upload flow end-to-end: drag MP3 → presigned URL → MinIO → worker transcodes → archive shows in channel

**4c — Live broadcasting (M3–M5)**
- OBS → RTMP ingest → Liquidsoap → HLS → `stream.tahti.live` → listener
- Icecast ingress for Mixxx/Traktor artists
- Auto-archive of live broadcasts
- Live chat (Centrifugo) working on the channel page

**Exit criteria for 4c:**
- One non-technical artist follows the OBS guide and broadcasts successfully.
- Archive appears in the channel within 5 minutes of stream end.
- 50 concurrent WebSocket connections hold without dropped messages.

---

## Phase 5 — Staging cluster (Month 3–4, parallel with Phase 4)

**Goal:** a second environment (`staging.tahti.live`) that is structurally identical to production but uses separate VMs and throw-away data, so deploys can be validated before hitting production.

### Steps

| # | Action | Note |
|---|--------|------|
| 1 | Provision 3 staging VMs (manager + 2 workers, 2 vCPU each) | UpCloud — can be smaller than prod |
| 2 | Init 3-node Swarm, assign node labels | Follow `docker-stack.yml` header |
| 3 | Create staging secrets (use random values, not real keys) | Separate `docker secret create` run on staging manager |
| 4 | Update GitHub Actions: deploy to staging on every push to `main`, deploy to production on tag `v*`; CI auto-tags `YYmmdd-buildnr` on each green `main` build | Two deploy jobs, same Makefile target |
| 5 | Add DNS: `staging.tahti.live` → staging edge node | Verify Caddy + TLS works |
| 6 | Run smoke test suite against staging after every deploy | Basic curl checks for `/health` endpoints |

**Exit criteria:**
- Every push to `main` auto-deploys to staging within 5 minutes.
- Production deploys are tag-gated and require a manual approval step in GitHub Actions.

---

## Phase 6 — Distribution, transparency, grants (Month 5–9)

**Goal:** an artist can publish a release to Spotify via Revelator, the transparency ledger is public, and the grant disbursement system is tested. **Stretch (Month 8–12):** first **M30 release-ops** pieces ship — MusicBrainz-guided submission and a release checklist — so catalog metadata is not re-entered on every external site.

This phase covers M6–M11 in `docs/AGENT.md`. Infra additions are minor (new worker queues already provisioned); the work is mostly application-level.

### Application deliverables

| Track | Milestone | Outcome |
|-------|-----------|---------|
| DSP delivery | **M7** | Mixcloud OAuth + upload; Revelator wizard → Spotify/Apple/Tidal |
| Catalog metadata | **M30** (incremental) | MusicBrainz submission flow + MBIDs on releases; ISRC/UPC/credits on release model; release-day checklist wizard |
| Money + governance | **M8–M10, M19** | Ledger, grants, fan-subs |

M30 does **not** replace M7 — it handles the **official/catalog** layer (MusicBrainz, identifiers, credits, society checklists) while M7 handles **store delivery**.

### Infra additions

| Addition | Reason |
|----------|--------|
| Add `worker-dist` replica to 2 | Revelator / Mixcloud jobs are slow; parallel processing prevents queue backup |
| Add ACRCloud webhook endpoint to API | Fingerprint matching for royalty tracking |
| Add Stripe Connect environment variable to `stack.env` | Fan subscriptions (M19) need this from the start for key rotation |
| Configure Postmark sending domain (DKIM/SPF) for `tahti.live` | Required before newsletter feature ships |

**Exit criteria:**
- At least one release successfully delivered to Spotify via Revelator.
- Transparency ledger at `app.tahti.live/transparency` shows real ledger entries.
- Grant disbursement dry-run completes without errors on Q4 synthetic data.
- *(M30 stretch)* At least one beta artist completes MusicBrainz submission from the dashboard and sees MBID links on their smart link page.

---

## Phase 6b — Release ops toolkit (Month 9–14, overlaps Phase 6–8)

**Goal:** artists have a **variety of release tooling** in one dashboard — the bureaucratic/metadata work is guided, not scattered across MusicBrainz, DSP portals, and spreadsheet templates.

See [project-roadmap.md §Phase 6b](./project-roadmap.md#phase-6b--release-ops--catalog-metadata-m30) for the full checklist. Build order:

1. Extend `Release` / `ReleaseTrack` with ISRC, UPC, credits, P/C lines, `musicbrainzReleaseId`, `musicbrainzRecordingIds[]`
2. Dashboard **Release checklist** wizard (metadata → identifiers → optional MusicBrainz → M7 DSP → publish smart link)
3. **MusicBrainz** integration: pre-fill from Tahti release, submit via MusicBrainz XML/API or export for Picard; store MBIDs
4. **Export pack** (JSON/CSV) for label copy and third-party tools
5. Post-release **claim links** (Spotify for Artists, Apple Music for Artists) — checklist only

**Exit criteria:**
- Artist creates release in Tahti, walks checklist, submits to MusicBrainz without leaving the dashboard (or with one Picard export step documented).
- Smart link `/r/:slug` shows ISRC + MusicBrainz link when present.
- No duplicate metadata entry between Tahti release form and MusicBrainz fields.

---

## Phase 7 — Production-grade hardening (Month 8–9, pre-public launch)

**Goal:** the platform is ready for public signup at the quality level where €40/year is a fair ask.

| Item | Action |
|------|--------|
| Rate limiting | API: 100 req/min per IP unauthenticated, 1000/min per authenticated artist |
| Audit log | Append-only table for all write actions (create/update/delete on channels, releases, payouts) |
| Backup verification | Automated weekly restore test — cron job restores yesterday's PG dump to a temp schema and checks row counts |
| Security headers | Caddy: `Strict-Transport-Security`, `Content-Security-Policy`, `Permissions-Policy` on all routes |
| DDoS baseline | UpCloud / Hetzner firewall rules: allow 80/443/1935/8000 only; block all else at network level |
| Dependency audit | `pnpm audit --audit-level=moderate` in CI — block merges on high/critical |
| Load test | `k6 run` against staging: 500 concurrent listeners on one channel for 10 minutes |
| Penetration test | One-day manual review by a trusted external developer; fix all findings |

**Exit criteria:**
- Load test passes with P95 latency < 500 ms and zero 5xx errors.
- No open high/critical CVEs in `pnpm audit`.
- Ops runbook written: what to do when postgres goes down, when a stream fails, when MinIO fills up.

---

## Scaling reference

When to add nodes, and what to add:

| Signal | Action |
|--------|--------|
| API P95 > 500 ms under normal load | Add a second worker node, increase `api` replicas to 4 |
| `worker-media` queue depth > 50 jobs | Add a dedicated `role=worker` node, increase `worker-media` replicas to 3 |
| MinIO disk usage > 70 % | Add a second disk or migrate to distributed MinIO with 2+ `role=storage` nodes |
| Postgres connections > 80 % of `max_connections` | Add PgBouncer as a connection pooler (new service in the stack, api connects through it) |
| Caddy egress > 500 Mbps | Move HLS serving to Bunny CDN pull zone; Caddy becomes origin only |
| 500+ concurrent WebSocket connections on a single `chat` replica | Increase `chat` replicas to 3; verify Redis backplane handles fanout |

---

## Rollback procedure

```
# Roll back all app services one step (Swarm keeps the previous image)
make rollback

# Roll back a single service
docker service rollback tahti_api

# Emergency: redeploy a known-good tag
make deploy TAG=<last-good-sha>
```

Database migrations are append-only (no destructive ALTER in Phase 1–2). If a bad migration lands, rolling back the app image is safe — the new columns/tables are ignored by the old code. Once Phase 3 ships destructive migrations, add a `pre-deploy` migration check step to the CI workflow before that risk materialises.
