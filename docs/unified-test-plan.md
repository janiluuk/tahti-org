# Unified test plan (PRs #87–#132 + #133)

Consolidated from test plans in the last 40 merged PRs. Run in order; later phases assume earlier gates pass.

**Quick run (automated subset):**

```bash
./scripts/unified-smoke.sh              # Phase 0–1 + optional prod
./scripts/unified-smoke.sh --prod       # include https://app.tahti.live checks
./scripts/unified-smoke.sh --e2e        # also run vital-flows + user journeys (stack must be up)
```

See also [`testing.md`](testing.md) for Vitest / journey prerequisites.

---

## Phase 0 — CI gate (every PR)

| Check | Command | Source PRs |
|-------|---------|------------|
| Lint, format, typecheck | `pnpm ci:check` | #87–#132, #130, #108, #96, #107 |
| Design token guard | `pnpm check:tokens` | #130 |
| Unit tests (needs Postgres) | `pnpm test` | #87, #88, #90, #95, #117, #115, #113 |
| Tor exit list freshness | `pnpm tor-exit:check` | #90, #88 (included in ci:check) |

---

## Phase 1 — Stack health & infra

| Check | How | Source PRs |
|-------|-----|------------|
| Lab stack up | `./scripts/stack-up.sh` → API `:15011/health`, Web `:17777/` | #108, #107, #106 |
| PgBouncer path | API healthy with `DATABASE_URL` via pgbouncer | #108 |
| Icecast + orchestrator | `GET /health` shows `icecast`, `orchestrator` up | #107 |
| Tahti Radio channel seed | stack-up seeds `tahti-radio` for chat | #133 |
| Status page | `/status` or `/api/v1/status` — postgres check present | #108, #118 |
| SMTP / apply | Beta apply on `/apply`; entries in admin (if SMTP configured) | #107, #102 |
| Monitoring | `./ops/monitoring/vimage6/deploy.sh` — Grafana probes green | #107 |

---

## Phase 2 — Public / listener surfaces

| Route / flow | Expect | Source PRs |
|--------------|--------|------------|
| `/` | Gateway: Listen + Sign in CTAs, feature list | #104, #126 |
| `/listen` | Live cards (green accent), recent channels | #104, #106 |
| `/login`, `/verify` | Dark auth shell, BgCanvas | #105, #130 |
| `/signup` | Signup wizard **or** beta-closed notice (env `SIGNUP_OPEN`) | #126, #132, #130 |
| `/apply` | Redirect or apply form → admin beta queue | #126, #107, #102 |
| `/c/:slug` | WaveformPlayer when live; LiveChatPanel; sticky live bar; archive RSS | #101, #130, #108, #105 |
| `/u/:username` | Profile SVG CTAs, newsletter widget (dark) | #104, #109, #105 |
| `/u/:username/subscribe` | TierCard grid | #130 |
| `/r/:slug` | ReleaseSmartLink + DSP SVG buttons | #101, #105, #130, #125 |
| `/radio` | Channel shell, video **or** HLS player, live chat | #106, #126, #133 |
| `/v/:slug` | Venue hero, upcoming/past events | #106 |
| `/venues` | Verified venues list | #95, #96 |
| `/help/broadcast` | Prose: cyan step badges, h2 dividers | #106, #109 |
| `/transparency`, `/governance` | Stats cards, prose accents | #123, #109, #96 |
| `/status` | Public status UI | #108, #111 |
| `/dev/components` | All v8 primitives (dev only) | #130 |
| Wildcard `*.tahti.live` | Channel slug routing | #123 |
| Custom domain | TXT verify flow, verified badge | #123 |

**Automated:** `pnpm test` (journey suites below), `pnpm test:e2e:journeys:listener`, `pnpm test:e2e:live-chat`

| Vitest journey file | Covers |
|---------------------|--------|
| `persona-journeys.test.ts` | Listener, artist studio, member governance, director admin, ops health |
| `vital-flows.test.ts` | Onboarding, fan subs, catalog gates, live broadcast, governance vote |
| `public-surfaces-journey.test.ts` | Home/Discover stats + channels, radio, venues directory, status |
| `tahti-radio-journey.test.ts` | Tahti Radio channel, chat tokens, announcements, member relay |

---

## Phase 3 — Artist dashboard & streaming

| Flow | Expect | Source PRs |
|------|--------|------------|
| Login → `/dashboard` | Sidebar SVG icons, user initial, live dot when broadcasting | #104, #105, #101 |
| Go live / end broadcast | BroadcastStatusBar, End Broadcast → offline | #101, #130 |
| Stat tiles | Real values; colored top borders | #101, #105 |
| `/dashboard/stats` | Loads; listener geo map + period tabs (7d/30d/all) | #132, #101, #111 |
| Channel appearance | Visual preset, color scheme, slideshow controls | #125, #132 |
| Archive trim / LUFS bounce | New version + transcode | #102 |
| `/dashboard/editor` | Multitrack session, mixdown export | #102 |
| `/dashboard/stash` | Upload + share links | #101 |
| Collection editor | Cover, description, theme | #108, #113 |
| Social connect | Twitter/X OAuth (credentials required) | #108, #113 |
| Mixcloud connect | OAuth completes | #89, #132 |
| Newsletter composer | Markdown + inbox preview pane | #128 |
| Privacy panel | JSON export, deletion request | #96 |
| Form inputs | Focus ring, invalid state | #126 |

**Automated:** `pnpm test:e2e:journeys:artist`, `pnpm test:e2e:dashboard-player`

---

## Phase 4 — Admin & governance

| Route / flow | Expect | Source PRs |
|--------------|--------|------------|
| Board login → `/admin` | AdminShell, nav active states, avatar pill | #104, #105, #118, #130 |
| `/admin/dashboard` | Card tiles | #118 |
| `/admin/radio` | Now-playing, eligible channels, history, opt-out | #126 |
| `/admin/beta` | Approve/reject applications | #102 |
| `/admin/settings/vendors` | Mixcloud/Revelator LIVE or STUB | #123, #132 |
| `/admin/users` | Suspend / unsuspend | #95, #96 |
| `/admin/financial`, `/admin/governance` | Ledger, grants, AGM | #96, #118 |
| `/admin/support` | Ticket create/resolve | #96 |
| Force-offline live channel | Admin action works | #96 |
| Member register JSON | Director journey endpoint | #88, #90 |

**Automated:** `pnpm test:e2e:journeys:director`, `pnpm test:e2e:journeys:ops`

---

## Phase 5 — Media, chat & distribution

| Check | How | Source PRs |
|-------|-----|------------|
| Live HLS player | Play on `/c/:slug`; waveform reacts | #101, #116, #115 |
| Chat publish | Guest handle + message on channel/radio | #128, #133 |
| Reactions overlay | Emoji fly on player | #101 |
| Archive waveform peaks | Peaks in API + UI | #115 |
| Visual presets on channel/release | Three.js canvas (no motion if reduced) | #125, #132 |
| Slideshow presets | FADE/ZOOM on channel gallery | #125 |
| RSS feeds | `/api/v1/u/:handle/rss.xml`, channel archive RSS link | #108, #109 |
| Discogs prefill | Release ops guided submission | #117 |
| Listener geo | Download country + HLS Redis aggregates | #132 |
| Ingest hot rotation | `ingest.test.ts`, vital-flows | #87 |
| Distribution prod checks | `pnpm prod:check-distribution` (Swarm + secrets) | #132, #89, #94 |

**Automated:** `pnpm test:e2e`, `pnpm test:e2e:release-upload`

---

## Phase 6 — Production smoke

Run after deploy (`./scripts/deploy_prod.sh` or Swarm `make deploy`):

| Check | Command / URL |
|-------|----------------|
| API health | `curl -sf https://api.tahti.live/health` |
| App home | `https://app.tahti.live/` |
| Radio 24/7 | `https://app.tahti.live/radio` — player + chat token |
| Transparency API | `https://api.tahti.live/api/v1/transparency/ytd` |
| Marketing site | `https://tahti.live/` (static; `/radio` is **not** the app) |
| Status monitor | GitHub **Status monitor** workflow or `./scripts/status-monitor.sh` |

```bash
./scripts/unified-smoke.sh --prod
```

---

## Phase 7 — Visual regression (manual)

| Check | Source PRs |
|-------|------------|
| `./scripts/stack-up.sh --seed` + `./scripts/e2e-screenshots.sh` | #120, #131 |
| Spot-check `docs/e2e-screenshots/public/channel.png`, `artist/dashboard.png`, `admin/dashboard.png` | #131 |
| User-journey SVG renders | #128 |

---

## PR coverage notes

- **No test plan in body:** #87–#89, #96–#98, #110, #112, #114, #116, #121–#122, #127, #129 — covered by phases above via feature area.
- **#133 (radio 24/7):** Phase 2 `/radio`, Phase 1 seed, Phase 6 prod smoke — not yet merged to `main` at doc write time; deployed from branch on vimage.

---

## Failure triage

| Symptom | Likely fix |
|---------|------------|
| API exits on start | Check API Dockerfile includes all workspace packages (e.g. `@tahti/revelator`) |
| Chat 404 on `/radio` | Run `seed-tahti-radio.ts` |
| Vitest DB errors | Start Postgres: `docker compose -f infra/docker-compose.dev.yml up postgres -d` or full stack |
| `/radio` old UI on prod | Rebuild `web` service; app is at `app.tahti.live`, not `tahti.live` |
| Signup form vs beta closed | Set `SIGNUP_OPEN=true` in stack env |
