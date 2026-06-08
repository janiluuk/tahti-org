# User flows & screen map

Screenshots live in [e2e-screenshots/](e2e-screenshots/). Capture locally via `./scripts/e2e-screenshots.sh` (not run in CI).

For **how to distribute Swarm nodes by bottleneck** (API, chat, transcode, ingest, egress), see [scaling-node-distribution.md](scaling-node-distribution.md).

## Personas

| Persona | Who | Guide | Technical journey |
|---------|-----|-------|-------------------|
| **Listener** | Anyone tuning in; account optional | [for-viewers.md](guides/for-viewers.md) | [journey-listener.md](technical/journey-listener.md) |
| **Member** | Tahti ry cooperative member (€40/year) | [for-members.md](guides/for-members.md) | [journey-member.md](technical/journey-member.md) |
| **Artist** | Member with channel, releases, fan tiers | [for-artists.md](guides/for-artists.md) | [journey-artist.md](technical/journey-artist.md) |
| **Director / board** | Executive + board — grants, ledger, governance admin | — | [journey-director.md](technical/journey-director.md) |
| **Ops** | Deploy, monitor, recover the platform | [RUNBOOK.md](../ops/RUNBOOK.md) | [journey-ops.md](technical/journey-ops.md) |

**Streamer** is the live-broadcast slice of the artist path: [for-streamers.md](guides/for-streamers.md).

## Site map

```mermaid
flowchart TB
  home["/ — Home"]
  join["/join"]
  login["/login"]
  verify["/verify"]
  trans["/transparency"]
  method["/transparency/methodology"]
  channel["/c/:slug"]
  profile["/u/:username"]
  subscribe["/u/:username/subscribe"]
  smart["/r/:slug"]
  dash["/dashboard"]
  gov["/governance"]
  govVenues["/governance/venues"]

  home --> join
  home --> login
  join --> verify
  login --> dash
  login --> gov
  profile --> channel
  profile --> subscribe
  smart --> profile
  trans --> method
  gov --> govVenues
```

## Automated journey e2e

| Script | Personas / scope |
|--------|------------------|
| `tests/e2e/run-all-journeys.sh` | **All** — vital-flows + user-journeys + Vitest `persona-journeys.test.ts` |
| `tests/e2e/user-journeys.sh` | Listener, artist, streamer, member, fan supporter, director, ops, dashboard/player |
| `tests/e2e/vital-flows.sh` | Transparency, auth guards, Stripe webhook smoke, Icecast cap |
| `tests/e2e/journeys/listener.sh` | Public browse only |
| `tests/e2e/journeys/artist.sh` | Studio + ingest |
| `tests/e2e/journeys/member.sh` | Governance + fan sub |
| `tests/e2e/journeys/director.sh` | Board admin grants preview, members CSV, public transparency |
| `tests/e2e/journeys/ops.sh` | `/health`, `/api/v1/status`, `/metrics`, `/docs` |
| `tests/e2e/journeys/dashboard-player.sh` | Dashboard studio APIs + channel/embed player data |
| `tests/e2e/user-journeys.mjs` | Same personas in Playwright (needs `APP_URL` + seeded fixtures) |
| `tests/e2e/dashboard-player.mjs` | Playwright: dashboard navigation + archive/live players |
| `apps/api/src/routes/journeys/persona-journeys.test.ts` | Listener / artist / member / director / ops API paths (Vitest) |

```bash
# Full suite (API must be running; Postgres + Redis required)
SEED_JOURNEY_FIXTURES=1 DATABASE_URL=postgres://tahti:tahti_dev@localhost:5432/tahti \
  API_URL=http://localhost:3001 pnpm test:e2e:journeys:all

# CI-style (API only, no Vitest wrapper)
SEED_JOURNEY_FIXTURES=1 DATABASE_URL=postgres://... API_URL=http://localhost:3001 pnpm test:e2e:journeys

# Per persona
pnpm test:e2e:journeys:director
pnpm test:e2e:journeys:ops

# Local Playwright
API_URL=http://localhost:3011 APP_URL=http://localhost:3010 pnpm test:e2e:journeys:web
```

Seed fixtures: `cd apps/api && DATABASE_URL=... pnpm exec tsx scripts/seed-e2e-screenshots.ts` or `make stack-up --seed`.

Demo accounts (after seed): `screenshot-demo` (artist), `screenshot-fan` (member/fan), `screenshot-board` (board). Password: `screenshot-demo-pass`.

---

## Detailed journeys → routes & API

Each technical doc expands sequence diagrams and friction maps. This table maps **implemented** steps to automated tests.

### Listener — no account

| Step | Web route | API | E2e |
|------|-----------|-----|-----|
| Land on home | `/` | — | Playwright `user-journeys.mjs` |
| Open artist profile | `/u/:username` | `GET /api/v1/u/:username/profile` | `listener.sh`, Vitest |
| Browse fan tiers | `/u/:username/subscribe` | `GET /api/v1/u/:username/tiers` | `listener.sh`, Vitest |
| Open smart link | `/r/:slug` | `GET /api/v1/r/:slug` | `listener.sh`, Vitest |
| Tune in (channel) | `/c/:slug` | `GET /api/channels/:slug` | `listener.sh`, Vitest |
| Chat access check | — | `GET /api/chat/:slug/access` | `listener.sh` |
| Transparency | `/transparency` | `GET /api/v1/transparency/ytd` | `listener.sh`, `vital-flows.sh` |
| Embed player data | `/embed/c/:slug` | `GET /api/v1/embed/c/:slug` | `dashboard-player.sh`, Vitest |

### Member — cooperative governance

| Step | Web route | API | E2e |
|------|-----------|-----|-----|
| Register | `/join` | `POST /api/auth/register` | `vital-flows.sh` (register only) |
| Verify email | `/verify?token=…` | `GET /api/auth/verify` | Manual / seed token |
| Login | `/login` | `POST /api/auth/login` | `member.sh` |
| Governance hub | `/governance` | `GET /api/v1/governance/members`, `GET /api/v1/governance/motions` | `member.sh`, Vitest |
| Auth guard (anon) | — | governance routes → **401** | `member.sh`, `vital-flows.sh` |

### Fan supporter (listener with account)

| Step | Web route | API | E2e |
|------|-----------|-----|-----|
| Login as fan | `/login` | `POST /api/auth/login` | `member.sh` (`run_fan_supporter_journey`) |
| View subscriptions | `/dashboard` | `GET /api/me/subscriptions` | `member.sh` |
| Subscribe page | `/u/:artist/subscribe` | — | `member.sh` (web reachability) |

### Artist — studio & live

| Step | Web route | API | E2e |
|------|-----------|-----|-----|
| Login | `/login` | `POST /api/auth/login` | `artist.sh` |
| Dashboard | `/dashboard` | `GET /api/auth/me`, `GET /api/me/releases` | `artist.sh`, `dashboard-player.sh` |
| Fan tiers | `/dashboard` | `GET /api/me/fan-tiers` | `artist.sh` |
| Membership status | `/dashboard` | `GET /api/me/membership` | `artist.sh` |
| Stream settings (OBS) | `/dashboard` | `GET /api/me/stream-settings` | `artist.sh`, `dashboard-player.sh` |
| Multistream targets | `/dashboard` | `GET /api/me/rtmp-targets` | `artist.sh` |
| Icecast connect | — | `POST /internal/icecast/on_connect` | `artist.sh`, `vital-flows.sh` |
| Archive & player | `/c/:slug` | `GET /api/me/archive`, `GET /api/channels/:slug/items` | `dashboard-player.sh` |
| Download gate stats | `/dashboard` | `GET /api/me/download-gate-stats` | `dashboard-player.sh`, Vitest |

### Director / board

| Step | Web route | API | E2e |
|------|-----------|-----|-----|
| Public transparency | `/transparency` | `GET /api/v1/transparency/ytd`, `GET /api/v1/transparency/grants/:year` | `director.sh`, `vital-flows.sh` |
| Grant preview (dry run) | `/governance` (admin UI TBD) | `GET /api/admin/grants/preview/:year` | `director.sh`, Vitest |
| Members export | — | `GET /api/admin/members/export.csv` | `director.sh`, Vitest |
| Venue verification | `/governance/venues` | `GET/POST /api/admin/venues/*` | `director.sh` (web), Vitest admin tests |
| Auth guard (anon) | — | admin routes → **401** | `director.sh`, Vitest |

### Ops — health & observability

| Step | Where | API / endpoint | E2e |
|------|-------|----------------|-----|
| Liveness probe | load balancer / CI | `GET /health` | `ops.sh`, `vital-flows.sh`, Vitest |
| Dependency status | status page | `GET /api/v1/status` | `ops.sh`, Vitest |
| Prometheus scrape | Grafana | `GET /metrics` | `ops.sh`, Vitest |
| OpenAPI reference | browser | `GET /docs` | `ops.sh` |
| Backup age alert | Prometheus | `tahti_postgres_backup_age_hours` in `/metrics` | `ops.sh` (warn if missing in dev) |

---

## Flows → screens (screenshot fixtures)

Full set by role: [e2e-screenshots/README.md](e2e-screenshots/README.md) · `manifest.json`

### Listener (no account) — `public/`

| Step | Route | Screenshot |
|------|-------|------------|
| Land | `/` | [home.png](e2e-screenshots/public/home.png) |
| Channel | `/c/screenshot-demo` | [channel.png](e2e-screenshots/public/channel.png) |
| Profile | `/u/screenshot-demo` | [profile.png](e2e-screenshots/public/profile.png) |
| Fan tiers | `/u/screenshot-demo/subscribe` | [subscribe.png](e2e-screenshots/public/subscribe.png) |
| Smart link | `/r/northern-lights-ep` | [smart-link.png](e2e-screenshots/public/smart-link.png) |
| Transparency | `/transparency` | [transparency.png](e2e-screenshots/public/transparency.png) |

### Free listener — `free/`

| Step | Route | Screenshot |
|------|-------|------------|
| Dashboard | `/dashboard` | [dashboard.png](e2e-screenshots/free/dashboard.png) |

### Member (cooperative) — `member/`

| Step | Route | Screenshot |
|------|-------|------------|
| Register | `/join` | [join.png](e2e-screenshots/public/join.png) |
| Verify | `/verify?token=…` | [verify-token.png](e2e-screenshots/public/verify-token.png) |
| Dashboard | `/dashboard` | [dashboard.png](e2e-screenshots/member/dashboard.png) |
| Governance | `/governance` | [governance.png](e2e-screenshots/member/governance.png) |

### Artist (studio + optional live) — `artist/`

| Step | Route | Screenshot |
|------|-------|------------|
| Login | `/login` | [login.png](e2e-screenshots/public/login.png) |
| Dashboard | `/dashboard` | [dashboard.png](e2e-screenshots/artist/dashboard.png) |
| Stats | `/dashboard/stats` | [stats.png](e2e-screenshots/artist/stats.png) |
| Live channel | `/c/screenshot-demo` | [channel.png](e2e-screenshots/public/channel.png) |

### Board admin — `admin/`

| Step | Route | Screenshot |
|------|-------|------------|
| Dashboard | `/admin/dashboard` | [dashboard.png](e2e-screenshots/admin/dashboard.png) |
| Users | `/admin/users` | [users.png](e2e-screenshots/admin/users.png) |
| Financial | `/admin/financial` | [financial.png](e2e-screenshots/admin/financial.png) |
