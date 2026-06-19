# Tahti — project roadmap & handover checklist

Master task list to go from **documentation package → funded nonprofit → working
platform → tested beta → operation by Tahti ry** (with trained member-operators).

**Status today (updated 2026-06-05):** specs, infra templates, and financial
model exist **and the application code is well underway**. The MVP broadcasting
stack (M0–M6), live chat (M5), transparency ledger (M8), annual grant engine (M9),
member governance (M10), download engagement units (M18 core), fan-to-artist
subscriptions (M19 core), hardening exports (M11 partial), artist profiles +
releases (M12 partial), newsletter/embed/mentions/radio/venues (M13–M17 partial),
archive metadata (M22), collections (M23), and tier gating (M20 partial)
are implemented with **~230 Vitest tests** (56 files) and **three CI e2e layers**
(vital-flows curl, user-journey curl, local Playwright screenshots). See the
[Build audit](#build-audit--current-state-2026-06-03) and
[Platform engineering backlog](#platform-engineering-backlog) below, plus
[future-improvements.md](./future-improvements.md) for deferred work.

**Target Year 1 plan:** 200 paying members · founding grant for capex/growth ·
first AGM · handover-ready ops by month 12–18. Ops balance without a fixed
salary line; maintenance team paid equally from surplus when positive.

Use this as a GitHub Project / issue checklist (`- [ ]` = open).

---

## How to read this

| Column | Meaning |
|---|---|
| **Owner** | Who does the work: `Director`, `Board`, `Dev`, `Treasurer`, `Members` |
| **Depends** | Must be done first |
| **Doc** | Detailed spec |

**Recommended build order:** legal + grants in parallel with **MVP (M0–M5)** →
closed beta → **M7–M9, M19** (money + grants) → remaining features → handover.

---

## Build audit — current state (2026-06-03, updated)

Audit of the actual code in `apps/`, `services/`, `packages/`, and `website/`
against `docs/AGENT.md`. Verified by `pnpm ci:check` (lint, format, typecheck),
`pnpm test` (~230 tests, Postgres required, `maxWorkers: 1`), and CI jobs in
`.github/workflows/ci.yml`.

### Work completed (high level)

| Area | Delivered |
|---|---|
| **Core platform** | M0–M6 MVP (accounts, upload, live ingest, archive, chat, multistream) |
| **Money & governance** | M8 ledger, M9 grants, M10 motions, M1/M19 Stripe paths (REST + webhooks) |
| **Artist product** | M12 profiles/releases/smart links, M18 downloads, M20 cap/HLS tiers, M22 metadata, M23 collections/RSS |
| **Community** | M13 newsletter API, M14 embed, M15 mentions, M16 radio, M17 venues |
| **Quality** | 56 Vitest files, journey + vital-flows + user-journey bash e2e, OpenAPI at `/docs` |
| **CI / DX** | Lint gate, format check, typecheck, AGPL header check, website Docker build |
| **Local ops** | `infra/docker-compose.stack.yml`, `scripts/stack-up.sh`, `scripts/ci-check.sh`, `docs/scaling-node-distribution.md` |
| **Docs / design** | `docs/design-system.md`, `packages/ui/` tokens + components (not yet wired into web), plain-language guides |
| **Marketing site** | OG tags, inline apply form, bg-audio + favicons, Three.js hero (`website/`) |

### Milestone matrix

| Milestone | State | Evidence / notes |
|---|---|---|
| **M0** Skeleton | ✅ Done | pnpm + Turborepo monorepo, AGPL headers, CI, `/health`, `/source`, footer link |
| **M1** Accounts + membership | 🟢 Done | Email/password signup, email verify, sessions; verify → `PENDING_PAYMENT`; `POST /api/me/membership/checkout` (Stripe Checkout **annual subscription** when configured, dev-direct otherwise); webhook `checkout.session.completed` + `invoice.paid` → membership + ledger; **`POST /api/me/membership/portal`** + dashboard “Manage billing”; board CSV export; **renewal reminder** + **membership lapse** worker crons; **legacy one-time → Stripe subscription migration** (`subscriptionMigrationRequired` + checkout); **`GET /api/admin/members/legacy-subscriptions`** + admin queue UI. Deferred: none |
| **M2** Channel + archive upload | ✅ Done | Presigned S3-multipart upload (resolves Topic 5 → option A), transcode worker, channel page |
| **M3** Live ingress + orchestrator | ✅ Done | Icecast + RTMP webhooks, orchestrator + Liquidsoap template, HLS player. Path-based routing `/c/<slug>` (resolves Topic 9 → option B/C). WebRTC browser-live deferred (Topic 6) |
| **M4** Auto-archive | ✅ Done | `archive-broadcast` worker finalizes live recordings into archive items |
| **M5** Live chat | ✅ Done | Centrifugo token/message/announcements/ban + reactions + presence |
| **M6** Multistream RTMP | ✅ Done | Per-channel targets, encrypted stream keys, `alwaysMirror` gated to STUDIO |
| **M7** Distribution (Mixcloud + Revelator) | 🟡 Partial | Mixcloud OAuth + archive upload queue; Revelator wizard + royalty sync; **`pnpm prod:check-distribution`** validates Swarm secrets; admin **live/stub** badges on `/admin/settings/vendors`. Remaining: board obtains live Mixcloud app approval + Revelator API key + ISRC registrar (ops — run check scripts after configure) |
| **M8** Transparency ledger | ✅ Done | Append-only ledger, monthly rollup worker, public `/transparency` API + `/transparency/grants/:year` report |
| **M9** Annual grant calc | ✅ Done | `packages/ledger`: pure largest-remainder `allocateGrants` + `runAnnualGrantCalc` (reads rollups + counted downloads), `GrantDisbursement` model, `GRANT_DISBURSEMENT`/`RESERVE_TRANSFER` ledger entries, March-1 cron, board run + artist/public report endpoints. Fan-sub euro input lands with M19 |
| **M10** Member governance | ✅ Done | `Motion`/`Vote` models, `requireMember`/`requireBoard` guards, advisory voting (Topic 11), members `/governance` portal, tally hidden until close |
| [~] | **M11** Hardening | 🟡 Partial | Rate limiting, hCaptcha, audit log, `/api/v1/status`, OpenAPI `/docs`, structured logging, Stripe webhook + backup age on `/metrics`, **ACRCloud identify counters** (inactive until `ACRCLOUD_ENABLED`), **status monitor GHA** + **Upptime config** + **`bootstrap.sh`**, **`/help/tier-limits`**, **status link in app footer** (`status.tahti.live`), **interim public `/status` page** (reads `/api/v1/status`). Deferred: live Upptime fork deploy |
| **M12** Profile + releases | 🟢 Done | Release CRUD, smart links, DSP editor, profile playback, cover art, JSON-LD/ISR, sitemap, press kit JSON, CSV bulk import |
| **M13** Newsletter | 🟡 Partial | `newsletter` schema (Subscriber/Draft/Send), double opt-in API, artist draft + send, `newsletter-dispatch` worker, per-tier limits; **listener opt-in UI** on `/c/:slug` and `/u/:username`; **bounce webhook** (`POST /api/webhooks/email/bounce` — Postmark + SNS), **`ops/EMAIL.md`**. Deferred: dedicated SES API transport if SMTP limits hit |
| **M14** Embed/promo | 🟢 Done | `GET /oembed`, embed API + play URL, embed pages; **smart-link view counts** on `/r/:slug` + dashboard; **DSP click tracking** (`POST /api/smartlink/click`, `GET /api/me/releases/:id/analytics`); **Mastodon + Bluesky auto-post v0**; **Twitter/X OAuth 2.0 PKCE** (connect, toggles, manual post, worker dispatch); **Instagram auto-post** (OAuth connect, scheduled posting, dashboard panel). Deferred: none |
| **M24** Per-content visuals | 🟢 Done | Channel gallery + **channel video backdrop** + per-item banner/background/slideshow on `/c/:slug`; **YouTube/Vimeo** via `parseVideoEmbedUrl`; per-item `bannerUrl`/`backgroundUrl`/`slideshowUrls` editable in dashboard archive metadata panel. Deferred: none |
| **M15** Artist @-mentions | 🟢 Done | `lib/mentions.ts`, bio/announcement hooks, mute + settings API, **daily digest worker**, **`GET /api/v1/u/:handle/mentions`** (public opt-in), `@handle` links in plain text. Deferred: none |
| **M16** Tahti Radio meta-stream | 🟢 Done | `services/tahti-radio`, `GET /api/v1/radio` proxy, **`lastFeaturedAt` + history**, internal radio API, **public `/radio` page**. Deferred: Mixcloud Live multistream (PLAT-053, blocked on radio Liquidsoap config) |
| **M17** Venue calendar | 🟢 Done | Venue API + iCal; board verify API + **`/governance/venues`** admin UI; **public `/venues` + `/v/:slug`**; **`/venues/register`** submission UI. Deferred: none |
| **M18** Downloads first-class | 🟢 Done | Archive + release downloads, fraud-scan cron, Tor/datacenter CIDR; **daily Tor Redis sync** + **CI freshness check** + **weekly GHA sync PR** on bundled `tor-exit-cidrs.txt` (`pnpm tor-exit:check` / `pnpm tor-exit:sync`). Deferred: none |
| **M19** Fan-subs | 🟢 Done | Tiers, Connect + Checkout, webhook lifecycle, ledger split, perks, payout dashboard, subscriber export, fan portal, GDPR export/deletion, admin execute + purge cron |
| **M21** Admin panel | 🟢 Done | **`/admin` shell** (board guard), **dashboard**, **stream manager** + **force-offline**, **user directory** + suspend, **fan-sub payout queue**, **ledger UI**, **support tickets**, **beta application queue** (`/admin/beta` approve/reject + password setup links), **board resolutions**, **audit log viewer**, **annual report generator**, stats APIs + **`CronRun`** logging; **`/admin` link surfaced in main nav for board users**; **design-consistency pass** (status page renders health detail on 503, Financial/Governance landings restyled as cards, resolution-form layout fix, unified back-nav + filter pills, venue-queue dashboard tile). Deferred: platform-level content moderation/abuse-report queue |
| **M22** Archive metadata | 🟢 Done | Metadata editor + tracklist @tags; auto tags; lossless→FLAC; **follow/repost download gates** + per-item gate stats + **channel funnel** (`GET /api/me/channel-funnel-stats` + split endpoints; 14-day charts); **per-listener HLS metrics** — distinct daily listener counts from anonymized (daily-salted, non-reversible) Caddy edge-log hashes, surfaced as `peakDailyListeners` + per-day counts in the live-stats panel. Deferred: none |
| **M23** Collections + RSS | 🟢 Done | Schema + API CRUD, public JSON/RSS, featured collections, reorder API + **drag-and-drop** in dashboard; **per-artist archive RSS** (`/api/v1/u/:handle/rss.xml`); feed links on profile + dashboard; **per-collection video/slideshow themes**. Deferred: none |
| **M28** Track version history | 🟢 Done | Archive + **release-track** version history (upload/activate, worker transcode, dashboard panels; stable public ids via active-version sync) |
| **M30** Release ops toolkit | 🟢 Done | Release ops panel: catalog, credits, checklist, society pointers, JSON export, **MusicBrainz step-by-step guide**; **guided Discogs submission** (`discogsReleaseId` + clipboard prefill + in-panel guide + Discogs URL on smart link — Discogs has no artist-submission API, so this mirrors the MusicBrainz guided pattern); UPC/ISRC on `/r/:slug`; claim links (Spotify, Apple, YouTube). Deferred: none |
| **M31** Channel & release visual customization | 🟢 Done | Three.js visualizer presets (channel, release, archive playback); `node-vibrant` palette on release artwork upload → `paletteJson` + default `colorSchemeJson`; `--channel-*` CSS tokens on `/c/:slug` and `/r/:slug`; slideshow preset themes + dashboard controls; visual preset picker with live mini-canvas previews |
| **M29** Backup & DR | 🟡 Partial | **`scripts/backup.sh`** (postgres, minio DR mirror, restore-test, status + DR age); **`scripts/backup-drill.sh`** + quarterly cron; **`ops/RUNBOOK.md`** restore + drill table; `install-crons.sh`; `/metrics` backup gauge. Deferred: pgBackRest PITR |
| **M20** Tier gating | 🟢 Done | Weekly cap + **60s grace**, reconnect during grace, orchestrator **/stop** on cap enforcement, dashboard warnings + **`warningLevel`** API + **upgrade CTA**, HLS tier split, **`/help/tier-limits`**, vital-flows e2e |

### Improvements identified during the audit (added to the roadmap)

These are gaps and quality items found while reading the code. They are tracked
as their own checklist so they don't get lost between milestones.

| Done | Improvement | Why it matters | Suggested milestone |
|:---:|---|---|---|
| [x] | Wire Stripe Checkout for €40 membership + webhook → `REVENUE_SUBSCRIPTION` ledger entry | Verify → pay → member number + ledger; dev-direct path for tests; live Checkout via Stripe REST when `STRIPE_SECRET_KEY` set | M1 (core done) |
| [x] | Add `GrantDisbursement` model + annual grant cron + `/transparency/grants/:year` | The grant engine is "what makes Tahti a nonprofit" and is entirely absent | M9 (done) |
| [x] | Add board **role** (`User.isBoard` + `requireBoard`) so role checks stop using `isMember` as a proxy | Board-only actions are now gated properly; `admin/ledger` now uses `requireBoard` (manual ledger entries are board/treasurer-only) | M10 (done) |
| [x] | Reconcile tier model: code uses `FREE/ARTIST/STUDIO`, AGENT.md says `FREE/PAID` | Spec/code drift will cause confusion in M20 gating and pricing copy | M20 / doc fix |
| [x] | Adopt Zod schemas on newer routes (admin/ledger, rtmp-targets, governance) | Governance, RTMP, fan tiers, **admin ledger** on Zod; multi-section CSV export unchanged | ongoing hardening |
| [x] | **M30 release-ops toolkit** — MusicBrainz clipboard prefill in export pack + Revelator pre-fill from same release record | Export JSON includes `musicbrainzPrefill`; Revelator worker reads catalog fields | M30 / Phase 6b |
| [x] | **Tracklist @artist tags** — editable tracklist rows with `@handle` autocomplete; link to `/u/:handle`; M15 `TRACKLIST` mention surface | DJs credit guests and collaborators; hearthis-style tracklists without a social graph | M22 |
| [x] | Fix `runningsurplus` → `runningSurplus` key in `/transparency/ytd` response | Typo in a public API field; fixed (API + web consumer) before third parties depend on it | M8 polish (done) |
| [x] | Fix GitHub Actions CI so it actually runs (was a 0s "workflow file issue" on every run — job-level `hashFiles()` + a pnpm version conflict; also only triggered on PRs to `main`) | Tests never executed in CI; suite now runs on every PR with Postgres + Redis services | CI |
| [x] | Consolidate CI: lint job, vital-flows e2e, user-journey e2e, AGPL check, website Docker | Single `ci.yml` gate; Playwright screenshots stay local-only (`scripts/e2e-screenshots.sh`) | CI |
| [x] | Full local Docker stack (`stack-up.sh`, ports 3010/3011) + scaling node doc | Dev/stakeholder demos without host port clashes; ops handover reference | M11 / Phase 2 |
| [x] | Wire `@tahti/ui` into `apps/web` (tokens + components exist, web still uses inline CSS) | `/c`, `/u`, `/r` brand layouts; **`/dashboard` studio shell** (`brand-studio.css`) | M12 / DX |
| [x] | `@tahti/ui`: add `lint` script to Turbo pipeline | `packages/ui` ESLint via `turbo lint` | CI |
| [x] | Consolidate e2e seed scripts (`scripts/seed-e2e-screenshots.ts` vs `apps/api/scripts/`) | Root script re-exports `apps/api/scripts/seed-e2e-screenshots.ts` | CI / DX |
| [x] | Stripe webhook: return **500** on handler failure (Stripe retries; audit log retained) | Silent membership/fan-sub activation failures | M19 hardening |
| [x] | Automate `db push` / migrate in deploy pipeline (OPS-002) | Swarm deploy runs `db-migrate-deploy.sh --image`; lab `stack-up.sh` db-push unchanged | M0 / Phase 2 |
| [x] | Document local test prerequisites in README (`docker compose up postgres redis -d`, `pnpm ci:check`) | Onboarding friction; tests fail opaque without DB | M11 |
| [x] | **Postgres backup pipeline** — pgBackRest (or `pg_dump` interim) → MinIO `backups/pg/` → UpCloud offsite; daily cron + age alert | `backup.sh postgres` + `status` + `/metrics`; pgBackRest PITR deferred | M29 / Phase 2b |
| [x] | **MinIO mirror** — `mc mirror` tahti → UpCloud bucket daily; verify object count | `scripts/backup.sh minio` compares primary vs DR counts (1% tolerance) | M29 / Phase 2b |
| [x] | **Restore-test automation** — weekly script restores latest PG dump to throwaway DB, row-count check, log to `/var/log/tahti-restore-test.log` | Backups that are never restored are fiction; required before public beta | M29 / Phase 2b |
| [x] | **`ops/RUNBOOK.md` restore procedures** — Postgres point-in-time, MinIO bucket swap, DR read-only origin on UpCloud | Operator drills table + step-by-step restore; PITR note (pg_dump RPO ~24h) | M11 handover |
| [x] | Engagement-unit data pipeline (downloads + fan-sub euros) feeding grant calc | Both inputs now live: download weight (M18) + fan-sub gross euros (M19) feed `computeEngagementUnits` | M18 + M19 → M9 (done) |
| [x] | Fix `/admin/status` showing "Could not load status" whenever the system is unhealthy | `GET /api/v1/status` returns full per-service detail with a **503** when unhealthy, but the page gated on `res.ok` — so the breakdown only ever rendered when everything was already fine. Page now reads the JSON body regardless of status code | M21 polish |
| [x] | Restyle `/admin/financial` and `/admin/governance` landing pages from bare `.admin-link-list` to card tiles | They were the only two admin sections rendered as plain stacked text links — looked like placeholder sitemaps next to the card-based Dashboard one click away | M21 polish |
| [x] | Fix overlapping label/textarea in the board-resolution "Body (Markdown)" field | `<label>Body (Markdown)<textarea rows={6}/></label>` rendered inline, baseline-aligning the label text to the bottom-left corner of the tall textarea | M21 polish |
| [x] | Standardise admin sub-page back-navigation on a single `← Section` convention | Three different conventions existed (`← Dashboard`, `← Financial · Export CSV`, `Financial → Legacy memberships`) for the same affordance | M21 polish |
| [x] | Standardise status-filter pills (`.admin-filter-pills`) across Beta and Support queues, with an active-state highlight | Beta used pill buttons, Support used plain underlined text links for an identical filter pattern; neither highlighted the active filter | M21 polish |
| [x] | Surface the venue-verification queue with a dashboard tile + pending count | It was a fully working feature reachable only via a plain-text link buried in the Governance index — no nav entry or count the way Beta/Support/Members get | M17 / M21 polish |
| [ ] | Platform-level content moderation / abuse-reporting queue (flag + review + remove tracks, releases, profiles) | No `ContentReport`/`Flag`/takedown model exists; `ChatBan`/`ChannelModerator` only cover artist-side channel chat. Reports currently have to funnel through generic support tickets, which won't scale past the closed beta | M21 follow-up (post-beta) |

---

## Phase 0 — Association exists (blocking everything)

Without Tahti ry registered, you cannot sign grant agreements, employ a director,
or collect memberships.

| Done | Task | Owner | Depends | Doc |
|:---:|---|---|---|---|
| [ ] | Agree founding purpose, name **Tahti ry**, fiscal year (calendar) | Board | — | `governance-and-legal.md` |
| [ ] | Draft bylaws (*säännöt*) from sketch → Finnish legal review | Board | purpose | `governance-and-legal.md` |
| [ ] | Hold founding meeting (min. 3 founders); sign minutes | Board | bylaws draft | — |
| [ ] | Register association at PRH (~€100) | Board | founding meeting | `governance-and-legal.md` |
| [ ] | Open association bank account | Treasurer | PRH registration | — |
| [ ] | Elect interim board (chair, treasurer, tech trustee) | Board | registration | `governance-and-legal.md` |
| [ ] | Appoint director + define maintenance team roster (equal surplus share, §10 cap) | Board | bank account | `governance-and-legal.md` |
| [ ] | Register VAT if revenue expected >€15k in Y1 | Treasurer | bank account | `governance-and-legal.md` |
| [ ] | GDPR processing register + privacy policy published | Director | — | `governance-and-legal.md` |
| [ ] | Sign DPAs: Stripe, Revelator, Mixcloud, UpCloud, email provider | Director | accounts | `cdn-strategy.md`, `infra-strategy.md` |

**Exit criteria:** PRH registration number, bank account, board elected, director
employed, bylaws filed.

---

## Phase 1 — Grants & runway (start in parallel with Phase 0)

Goal: secure **≥€20k** to bridge Year 1 deficit (`financial-model.md`).

| Done | Task | Owner | Effort | Doc |
|:---:|---|---|---|---|
| [ ] | One-page project summary + budget (Y1–Y3 from financial model) | Director | 1 day | `financial-model.md` |
| [ ] | Deck / leave-behind for foundations (community + business slides) | Director | 1 day | `slides/` |
| [ ] | **Business Finland Tempo** — gap analysis + application | Director | 30–50 h | `funding-strategy.md` |
| [ ] | **Koneen Säätiö** — application (cultural innovation angle) | Director | 20–30 h | `funding-strategy.md` |
| [ ] | **Suomen Kulttuurirahasto** — regional/central application | Director | 15–25 h | `funding-strategy.md` |
| [ ] | Track co-funding narrative (membership ramp + committed director time) | Treasurer | 4 h | `funding-strategy.md` |
| [ ] | Grant income recorded in transparency ledger when awarded | Treasurer | — | `transparency-policy.md` |
| [ ] | Plan B if only €15k lands: defer capex, trim legal, maintenance unpaid until surplus | Board | 2 h | `funding-strategy.md` |

**Milestones:**

- [ ] **G1** — at least one application submitted (all three preferred)
- [ ] **G2** — ≥€20k grant committed or equivalent donation + member pre-sales
- [ ] **G3** — Y2 grant pipeline started (Koneen renewal, Helsinki culture, Musex)

---

## Phase 2 — Infrastructure & hardware (before public beta)

| Done | Task | Owner | Depends | Doc |
|:---:|---|---|---|---|
| [ ] | Procure Y1 hardware (servers, NVMe, UPS) per capex budget | Director | G2 or bootstrapped | `financial-model.md` |
| [ ] | Helsinki business fiber contract (symmetric gigabit) | Director | hardware | `infra-strategy.md` |
| [ ] | UpCloud Helsinki account for spillover/static | Dev | — | `infra-strategy.md` |
| [ ] | Backup colocation / DR target chosen (UpCloud Helsinki or aligned Finnish partner) | Dev | — | `infra-strategy.md` |
| [ ] | Domain **tahti.live** + DNS → Caddy on owned edge | Dev | association exists | `infra/Caddyfile` |
| [ ] | Docker Swarm (or Compose staging) from `infra/docker-stack.yml` | Dev | hardware | `infra/docker-stack.yml` |
| [x] | Secrets management (Docker secrets / sops) documented | Dev | stack up | `ops/secrets-management.md` |
| [ ] | Staging environment mirrors production topology | Dev | M0 | — |
| [x] | Monitoring + alerting (uptime, disk, Liquidsoap health) | Dev | stack up | `ops/monitoring/vimage6/` Grafana + Prometheus |
| [ ] | Negotiate 10 Gbps fiber quote for Y3 (risk item in financial model) | Director | Y1 running | `financial-model.md` |

**Exit criteria:** staging URL serves health checks; production hardware racked;
runbook for reboot / failover exists.

---

## Phase 2b — Backup & disaster recovery (before public beta)

Strategy summary from [`infra-strategy.md`](./infra-strategy.md) and
[`technical/phase-3.md`](./technical/phase-3.md). **Primary site:** owned Helsinki
hardware (Postgres, Redis, MinIO, Swarm). **Offsite copy:** UpCloud Helsinki
object storage (EU jurisdiction, DPA before launch).

| Layer | Method | RPO | RTO | Offsite |
|---|---|---|---|---|
| **Postgres** | pgBackRest WAL archive + daily base backup (interim: `pg_dump \| gzip`) | 1 hour | 4 hours | UpCloud bucket `tahti-backups/pg/` |
| **MinIO** (archive audio, HLS, derivatives) | `mc mirror` daily | 24 hours | 8 hours | UpCloud bucket `tahti-backups/minio/` |
| **Config & secrets** | GitOps in private Finnish-hosted repo; Docker Swarm secrets documented | — | 1 hour | Same repo + encrypted offline copy |
| **Redis** | Ephemeral (queues, sessions) — rebuild from Postgres on restore | — | 1 hour | Not backed up |
| **Ledger** | Same Postgres backup; restore test must verify `ledger_entry` row counts | 1 hour | 4 hours | Same as Postgres |

**Disaster scenario (primary hardware lost):** UpCloud bucket serves **read-only**
origin for static/audio; Postgres replica or restored dump on UpCloud accepts
signups and writes; **live broadcasting paused** until primary recovered or
failover stack promoted. Document exact DNS/Caddy cutover in `ops/RUNBOOK.md`.

### Implementation checklist

| Done | Task | Owner | Depends | Doc |
|:---:|---|---|---|---|
| [ ] | UpCloud object storage buckets provisioned (`pg/`, `minio/`, lifecycle rules) | Dev | UpCloud account | `infra-strategy.md` |
| [ ] | MinIO `backups` bucket on primary; `mc` alias configured on manager node | Dev | MinIO up | `technical/phase-3.md` |
| [x] | `scripts/backup.sh` — unified postgres + minio + restore-test + status (wrappers deprecated) | Dev | Postgres + MinIO up | `ops/RUNBOOK.md` |
| [x] | Cron: PG daily 03:00, MinIO daily 04:00, restore test Sunday 05:00 (`/etc/cron.d/tahti-backup`) | Dev | `scripts/backup.sh` + `install-crons.sh` | `technical/phase-3.md` |
| [x] | Monitoring alert: **backup age > 26h** → WARN; **> 48h** → page on-call | Dev | `backup.sh status` + **`/metrics` `tahti_postgres_backup_age_hours`** + `prometheus-tahti-alerts.yml` | `technical/journey-ops.md` |
| [ ] | pgBackRest (replace interim `pg_dump` when hardware stable) + WAL shipping | Dev | Postgres prod | `future-improvements.md` |
| [x] | Pre-destructive-op snapshot: `scripts/pre-destructive-db-snapshot.sh` before migrations / volume resize | Dev | — | `technical/phase-7.md` |
| [x] | `ops/RUNBOOK.md` — restore Postgres, restore MinIO prefix, DR read-only cutover | Dev | restore test passed once | Phase 9 |
| [~] | Operator drill: restore from yesterday's backup without director (timed exercise) | Operators | `./scripts/backup-drill.sh` automates restore-test + status | Phase 9 §8b |
| [ ] | DPA signed with UpCloud before storing artist/listener data offsite | Director | association | `infra-strategy.md` §GDPR |

**Exit criteria:** latest PG backup restorable within RTO in a documented drill;
MinIO mirror object count within 1% of primary; alert fires on stale backup in
staging test; treasurer confirms ledger row count matches post-restore.

---

## Phase 3 — Implementation: MVP (broadcasting beta)

Minimum to put **20–50 scene artists** on air. Full acceptance criteria in
`docs/AGENT.md`.

| Done | Milestone | Summary | Owner |
|:---:|---|---|---|
| [x] | **M0** | Monorepo, AGPL, CI, dev compose, `/health`, `/source` | Dev |
| [~] | **M1** | Artist signup, email verify, €40 checkout + ledger, member CSV export | Dev |
| [x] | **M2** | Channel, resumable archive upload, transcode pipeline | Dev |
| [x] | **M3** | Icecast + RTMP; Liquidsoap per channel; public channel page (browser live deferred) | Dev |
| [x] | **M4** | Auto-archive live sets to archive | Dev |
| [x] | **M5** | Live chat (Centrifugo), announcements, moderation, reactions, presence | Dev |
| [x] | **M20** (partial) | Free tier: 1 hr/week live cap + MP3 HLS; paid: FLAC HLS + unlimited live | Dev |

**MVP test matrix (must pass before inviting beta artists):**

| Done | Test | Method |
|:---:|---|---|
| [ ] | Register → verify email → pay €40 → appear in member export | manual + automated |
| [x] | OBS guide: copy-paste RTMP → LIVE within 5s | `/help/broadcast` + `obs-and-broadcasting-guides.md` |
| [ ] | Mixxx / Icecast path works | manual |
| [ ] | Stop broadcast → archive within 10s, no silence | manual |
| [ ] | Chat: anonymous join, 24h expiry, artist ban | manual |
| [x] | Free user hits weekly hour cap gracefully | M20 |
| [x] | Paid channel streams FLAC; free channel MP3 | M20 |
| [ ] | Load test: N concurrent listeners on one channel | script |

**Exit criteria:** 5 internal dogfood channels running 48h without intervention.

---

## Phase 4 — Implementation: money, transparency, grants

Required before first **real** membership money and first grant cycle.

| Done | Milestone | Summary | Owner |
|:---:|---|---|---|
| [x] | **M8** | Public transparency ledger + monthly rollup API + grants/:year report | Dev |
| [~] | **M7** | Mixcloud OAuth + upload; Revelator submit + **€8/release billing** ✅ (Studio included slots) | Dev |
| [x] | **M30** | **Release ops toolkit** — MusicBrainz submission, ISRC/UPC/credits, release checklist (see Phase 6b) | Dev |
| [x] | **M9** | Annual engagement-unit grant cron + report (`packages/ledger`, payout transfer pending Stripe Connect / M19) | Dev |
| [~] | **M19** | Fan-subscriptions: Connect, Checkout, crons, perks, fan newsletter UI, payout transfer retry; royalty sync deferred | Dev |
| [x] | **M10** (core) | Member directory, motions, advisory voting (Topic 11), governance portal | Dev |

**Test matrix:**

| Done | Test |
|:---:|---|
| [x] | Stripe membership + webhook → ledger entry (`membership.test.ts`) |
| [x] | Fan-sub: listener subscribes → payout split (Stripe + 2% ops fee) → 3 ledger entries (`fansubs.test.ts`) |
| [x] | Download → engagement unit increments (see `engagement-and-fansubs.md`) |
| [x] | Grant dry-run on synthetic data matches hand calc within 1 cent (`packages/ledger`, `admin/grants.test.ts`) |
| [x] | `/transparency` matches ledger exports |

---

## Phase 5 — Implementation: artist-facing product (post-MVP)

Can ship incrementally during beta.

| Done | Milestone | Summary | Priority |
|:---:|---|---|---|
| [x] | **M12** | Profile + releases + smart links + MinIO cover art | High |
| [x] | **M30** | Release ops toolkit (MusicBrainz + Discogs guided submission, catalog metadata, release checklist) | Medium |
| [x] | **M20** | Tier gating polish, upgrade UX | High |
| [x] | **M18** | Anonymous + fan downloads, anti-fraud (Tor/fraud cron, weekly GHA sync) | High |
| [x] | **M14** | Embed pages, smart-link analytics, and social auto-post (Mastodon, Bluesky, Twitter/X, Instagram) all done | Medium |
| [~] | **M13** | Newsletter API + worker + bounce webhook; SES broadcast sends remain (deferred) | Medium |
| [x] | **M6** | Multistream RTMP targets | Medium |
| [x] | **M16** | Tahti Radio meta-stream | Medium |
| [x] | **M15** | Artist @-mentions | Low |
| [x] | **M17** | Venue API + iCal + board verification UI + public pages | Low |
| [~] | **M11** | Rate limits, hCaptcha, audit export, OpenAPI; Upptime deploy remains (ops) | High before Y2 audit |

**Exit criteria:** profile URL shareable; downloads + fan-subs used by ≥10 beta artists.

---

## Phase 6 — hearthis parity (catalog UX)

See `competitive-gaps-hearthis.md` for full gap list.

| Done | Milestone | Summary |
|:---:|---|---|
| [x] | **M22** | Per-item metadata + editable tracklists with **@artist tagging** (dashboard tracklist editor wired) |
| [x] | **M23** | Collections (albums, mix series) + RSS; featured collections on profile and `/r/:slug`; **artist archive feed at `/api/v1/u/:handle/rss.xml`** |
| [x] | **M24** | Channel gallery/text layers + **channel video backdrop**; per-item banner/slideshow; YouTube/Vimeo on archive items |
| [x] | **M25** | Artist commentary on archive items (dashboard + public channel page); optional listener comments deferred |
| [x] | **M26** | Channel **video/image backdrop** + gallery/text-layer theme picker in dashboard; **collection cover + description edit** + **item thumbnails** on profile and `/u/:handle/c/:slug`; **per-collection slideshow/video themes** (independent gallery + text-layer picker on collections, dashboard editor + public rendering) |
| [x] | **M27** | **Programme API** + dashboard rotation editor; `fallback.m3u` respects `isFallback`, ordered/fair shuffle; live auto-archive joins rotation. **Moderator roles** — artists delegate chat moderation (ban/unban) to trusted listeners (`ChannelModerator`, dashboard delegation panel + `/dashboard/moderate/:slug` chat-ban UI). **Per-set visualisations** — worker extracts static waveform peaks during transcode/archive jobs (`peaks` JSON on `ArchiveItem`/`ArchiveItemVersion`), rendered as bars on `/c/:slug` archive items. Deferred: ACRCloud annotation cron |
| [x] | **M28** | **Track version history** — archive + release-track versions; activate; stable public ids via active version sync |
| [x] | **M31** | **Channel & release visual customization** — Three.js presets (channel + release + archive playback), cover-art palette extraction, CSS `--channel-*` tokens, slideshow themes, dashboard visual picker with mini-canvas previews |

## Phase 6b — Release ops & catalog metadata (**M30**)

Artists need more than a smart link and a Revelator upload: the **official** side of a release — open-catalog entries, identifiers, credits, and society paperwork — is fragmented across a dozen sites. **M30** bundles guided tooling so Tahti handles the boring part and the artist ships once.

**Principle:** one release record in Tahti → reusable metadata for every downstream system. No duplicate data entry.

| Done | Capability | Notes |
|:---:|---|---|
| [x] | **MusicBrainz submission** | MBID fields + submit link + **in-panel guide** + MusicBrainz URL on smart link |
| [x] | **Discogs submission** | Guided entry — `discogsReleaseId` field + prefill clipboard helper + **in-panel guide** (search-first, dedup-aware) + Discogs URL on smart link |
| [x] | **ISRC + UPC/EAN** | Release ops capture; display on `/r/:slug` |
| [x] | **Credits & roles** | Dashboard credits editor; JSON export |
| [x] | **Copyright lines** | P/C-line + label imprint |
| [x] | **Release checklist wizard** | Steps in release ops panel (`computeReleaseChecklist`) |
| [x] | **Post-release claim links** | Spotify for Artists, Apple, YouTube OAC |
| [x] | **Export pack** | Download JSON |
| [x] | **Collecting-society pointers** | Teosto, PRS, GEMA, etc. |

**Deferred (later M30+):** direct PRO registration, AllMusic pitch workflow. (Discogs has no artist-submission API — Tahti ships a guided clipboard-prefill + ID-storage flow instead, mirroring the MusicBrainz pattern.)

**Depends:** M12 release schema (partial ✅), M7 Revelator wizard (partial). **Doc:** `AGENT.md` §M30.

---

Spec in `audio-editor.md` (**M21**) — see **§M21 implementation options** for phased plan (v0 trim → v1 multitrack → v2 LUFS/limiter).

| Done | Task | Owner | Doc |
|:---:|---|---|---|
| [x] | **v0** Single-file trim/fade + save to archive | Dev | `audio-editor.md` §Phased delivery |
| [x] | **v1** Multitrack timeline (`@waveform-playlist/browser`) | Dev | `audio-editor.md` |
| [x] | **v2** Master LUFS + limiter on bounce | Dev | `audio-editor.md` |
| [x] | Bounce worker → archive / release pipeline | Dev | `AGENT.md` |
| [x] | Editor load test (large WAV, 1h DJ mix) | Dev | `scripts/editor-load-test.sh` |

---

## Phase 7 — Channel & release visual customization (**M31**)

Artists should be able to personalize how their channel and release pages look and feel beyond static images. **M31** adds Three.js visualization presets, automatic color palette extraction from cover art, and backdrop slideshow customization — giving each channel a distinct visual identity without requiring any design skill.

**Principle:** sensible defaults from the content itself (cover art → palette), with optional overrides at both channel and release level. Three.js presets are pure client-side — no server rendering required.

| Done | Capability | Notes |
|:---:|---|---|
| [x] | **Cover art palette extraction** | `node-vibrant` on release artwork upload; `Release.paletteJson`; auto-applies as `colorSchemeJson` when no manual override |
| [x] | **Color scheme model + CSS variables** | `Channel.colorSchemeJson` + `Release.colorSchemeJson`; `--channel-*` on `[data-channel-root]`; resolved `colorScheme` in public API responses |
| [x] | **Three.js visualization presets** | `VisualPreset` enum; raw Three.js presets under `apps/web/src/components/visuals/`; audio-reactive bars/grid via `AnalyserNode` on archive playback |
| [x] | **Channel preset picker** | Dashboard "Visual style" panel: preset thumbnail grid + live mini-canvas; `PATCH /api/me/channel/visual` |
| [x] | **Per-release/archive visual override** | Release + archive editor panels; per-item preset on channel archive playback |
| [x] | **Backdrop slideshow preset themes** | `FADE`/`ZOOM`/`PAN`/`BLUR_CROSS`; interval + transition sliders; CSS animations on `/c/:slug`; `prefers-reduced-motion` pauses autoplay |
| [x] | **Public rendering** | `/c/:slug` and `/r/:slug`; lazy-loaded presets; WebGL fallback; reduced-motion honoured |

**Depends:** M24 per-content visuals (partial ✅), M26 backdrop + gallery themes ✅, M12 release schema ✅.

---

## Phase 8 — Closed beta → open beta (200 artists)

Aligned with `strategy-and-product.md` acquisition plan.

| Done | Task | Owner | When |
|:---:|---|---|---|
| [ ] | Recruit **10 anchor artists** (director network, invite-only) | Director | Month 1–3 |
| [x] | Beta application form (tahti.live + `/apply`) → support inbox + admin queue | Dev | Month 2 |
| [x] | Admin **Beta** tab: review applications, approve with username, email password setup link | Dev | Month 2 |
| [x] | `/setup-password` — invited artists create password and sign in | Dev | Month 2 |
| [ ] | Weekly beta office hours (Discord/video) | Director | Month 2–6 |
| [ ] | Fix P0 bugs within 48h SLA | Dev | ongoing |
| [x] | Publish OBS / Mixxx / Traktor guides on dashboard | Dev | M3 done |
| [ ] | Expand to **50 artists**; stress-test storage + fiber | Dev | Month 4–6 |
| [ ] | Press: RA tools / Wire / scene blogs (nonprofit + AGPL angle) | Director | Month 6 |
| [ ] | Open free tier widely; target **200 paying** by month 12 | Director | Month 6–12 |
| [ ] | First **AGM**: approve accounts, grant formula, board | Board | Month 12–15 |
| [ ] | First real **grant distribution** (if surplus > 0) | Treasurer | after AGM |

**Beta acceptance per artist:**

- [ ] Channel live ≥1h/week or archive fallback audible
- [ ] Profile published
- [ ] At least one broadcast tool guide completed
- [ ] Consent to beta terms + GDPR

---

## Phase 9 — Handover to the association

Goal: Tahti ry runs the platform **without depending on a single external
contractor**. Director may remain employed, but **members can operate it**.

### 8a — Documentation package

| Done | Deliverable | Owner |
|:---:|---|---|
| [x] | `ops/RUNBOOK.md` — deploy, rollback, **Postgres + MinIO restore**, DR cutover | Dev |
| [x] | `ops/BACKUP.md` — RPO/RTO table, cron schedule, offsite bucket names, escalation | Dev |
| [x] | `ops/INCIDENTS.md` — outage comms, escalation | Dev |
| [x] | `ops/ONBOARDING-OPERATOR.md` — training syllabus (infra/support/treasurer tracks) | Dev |
| [x] | `ops/TREASURER.md` — ledger import, grant payout, PRH export checklist | Dev |
| [x] | `ops/AGM-PLAYBOOK.md` — motions, voting, minutes template | Dev |
| [x] | `ops/ARCHITECTURE.md` — Swarm topology + data-flow diagrams | Dev |
| [x] | `ops/CREDENTIALS.md` — access matrix template (live data in board vault) | Dev |
| [x] | `ops/VENDORS.md` — vendor contact template | Dev |
| [x] | `ops/EMAIL.md` — Postmark + SES SMTP + bounce webhook setup | Dev |

### 8b — Operator training (target: 5 members by end Y1)

Tracks from `governance-and-legal.md` §7.b:

| Done | Trainee completes | Trainer |
|:---:|---|---|
| [ ] | **Infra track** — deploy, restart Liquidsoap, read monitoring, **trigger restore-test.sh** | Dev |
| [ ] | **Support track** — credentials, chat abuse, membership billing | Director |
| [ ] | **Treasurer track** — transparency dashboard, Stripe, grant export | Treasurer |
| [ ] | Operators roster approved at AGM | Board |
| [ ] | Runbook dry-run: restore from backup | Operators |

### 8c — Legal & asset transfer

| Done | Task | Owner |
|:---:|---|
| [ ] | GitHub org **tahti-ry** owns repo; director has admin, not sole owner | Board |
| [ ] | Domains, TLS certs, Stripe account owned by association | Board |
| [ ] | Hardware asset register (association property) | Treasurer |
| [ ] | Director role description + maintenance team compensation policy (equal split) | Board |
| [ ] | Director liability insurance (~€500/yr) | Board |
| [ ] | Annual audit firm engaged before €100k revenue (Y2) | Treasurer |

### 8d — Governance rhythms

| Done | Rhythm | Owner |
|:---:|---|---|
| [ ] | Monthly transparency rollup published ≤30 days | Treasurer |
| [ ] | Board meeting monthly (director report) | Board |
| [ ] | AGM annually (March): accounts, grants, board election | Board |
| [ ] | Member motions: 7-day circulation before vote | Board |
| [ ] | Bylaws changes via PR + member vote (⅔ if required) | Board |

**Handover exit criteria:**

- [ ] At least **3 trained operators** + director can take 2-week vacation without outage
- [ ] AGM completed with audited narrative (or qualified review if below threshold)
- [ ] All credentials in association name or shared vault with board access
- [ ] New member can join, pay €40, broadcast, and receive grant statement without director intervention

---

## Phase 10 — Ongoing (post-handover)

| Done | Task | Cadence |
|:---:|---|---|
| [ ] | Renew foundation grants (Y2 €45k, Y3 €80k targets) | annual |
| [ ] | Review €40 membership vs costs (storage, fiber) | annual AGM |
| [ ] | Engagement-unit formula review (membership debate) | annual AGM |
| [ ] | Security updates on Swarm nodes | monthly |
| [ ] | Backup restore drill (automated weekly + manual spot-check) | weekly / monthly |
| [ ] | Verify offsite backup age and object counts | weekly |
| [ ] | AGPL `/source` tarball matches deployed commit | each release |
| [ ] | PRH annual filing + tax return | annual |
| [ ] | Member count vs plan (200 → 1,200 → 4,000) | quarterly |

---

## Suggested timeline (single team, realistic)

```text
Month  1–2   Phase 0 legal + Phase 1 grant applications + M0–M1
Month  3–4   Phase 2 infra + **Phase 2b backup/DR** + M2–M3 + internal dogfood
Month  5–6   M4–M5 + M20 partial + 10-artist closed beta
Month  7–9   M7–M9, M19, M8 + **M30 release-ops planning** + 50-artist beta
Month 10–12  M12, M18, M14, **M30 MusicBrainz + checklist (incremental)** + push to 200 paying + first AGM
Month 13–18  Remaining features + operator training + handover package
```

Adjust if grants land late: **do not launch public beta without G2 funding**
unless maintenance team works unpaid until surplus and capex is deferred.

---

---

## Platform engineering backlog

Hardening, optimisations, and refactors identified in the **2026-06-03 audit**
(not tied to a single AGENT.md milestone). See also
[future-improvements.md](./future-improvements.md).

### Hardening (security & reliability)

| Done | ID | Item | Priority |
|:---:|---|---|---|
| [x] | **PLAT-001** | Stripe webhook dead-letter log + alert when `activateMembership` / fan-sub handlers fail | P1 |
| [~] | **PLAT-002** | Require branch protection on all `ci.yml` jobs (lint, test, both e2e, AGPL) | `.github/BRANCH_PROTECTION.md` — enable **All checks** in repo settings | P1 |
| [x] | **PLAT-003** | PgBouncer before scaling API replicas (`docs/scaling-node-distribution.md`) | Lab + Swarm stack wired (`infra/pgbouncer/`); prod cutover on next deploy | P1 |
| [x] | **PLAT-004** | Internal ingest routes: shared `@fastify/formbody` + integration tests for RTMP + Icecast | `ingest.test.ts` |
| [x] | **PLAT-005** | Swagger `/docs` credentials via Docker secrets, not env defaults | `DOCS_*_FILE` on API in `docker-stack.yml`; `readSecret` + prod warning; RUNBOOK rotation | P2 |
| [x] | **PLAT-006** | Rate-limit policy doc: fail-open vs fail-closed when Redis unavailable | P2 |

### Optimisations (performance & cost)

| Done | ID | Item | Priority |
|:---:|---|---|---|
| [~] | **PLAT-010** | Turbo remote cache in CI | `remoteCache` in `turbo.json`; `TURBO_TOKEN` + `TURBO_TEAM` on lint/typecheck — see `.github/TURBO_REMOTE_CACHE.md` |
| [x] | **PLAT-011** | Redis client singleton (status, rate-limit, sessions share one pool) | `apps/api/src/lib/redis.ts` | P2 |
| [~] | **PLAT-012** | Vitest parallel workers + Testcontainers (replace `maxWorkers: 1` + memberNumber bands) | `allocateMemberNumber()` test helper (dynamic member #); Testcontainers deferred | P2 |
| [x] | **PLAT-013** | Website Docker: mount large media (`bg-audio.mp3`, hero video) from host like `output_vhs.mp4` | `.dockerignore`, stack + local compose binds | P3 |
| [x] | **PLAT-014** | OpenAPI response schemas generated from Zod (keep `/docs` in sync with routes) | All JSON + CSV/plaintext/redirect routes documented |

### Refactors (maintainability)

| Done | ID | Item | Priority |
|:---:|---|---|---|
| [x] | **PLAT-020** | Adopt `@tahti/ui` in `apps/web` dashboard + public pages | Studio + public brand shells; channel/profile/governance/embed; dashboard `studio-*` CSS; gallery + tracklist on brand tokens |
| [x] | **PLAT-021** | Zod on all route bodies | Path/query/body validation via `@tahti/shared` schemas on public and authenticated routes |
| [x] | **PLAT-022** | Single e2e seed module exported from `@tahti/db` test helpers or `apps/api/scripts/` only | P2 |
| [x] | **PLAT-023** | Centralise worker cron registration (`apps/worker/src/index.ts` → job manifest) | P2 |
| [x] | **PLAT-024** | Shared `exportCsv(reply, rows)` for admin exports | `sendCsv()` — members, audit, fan-subscriber exports |
| [x] | **PLAT-025** | Remove `eslint.ignoreDuringBuilds` in web Dockerfile once lint clean in CI | `next.config.mjs` — lint enforced at `next build` | P3 |
| [x] | **PLAT-026** | Reconcile tier enum in AGENT.md (`FREE/PAID` vs `FREE/ARTIST/STUDIO`) | P2 |

### UI / Design alignment (reference mockup parity)

Gaps identified 2026-06-05 by comparing `docs/reference-screenshots/` against the
live app. All items target the dark brand palette already defined in
`packages/ui/src/tokens.css` — no new design decisions needed.

| Done | ID | Item | Effort | Priority |
|:---:|---|---|---|---|
| [x] | **PLAT-030** | **Stats page** — create `/dashboard/stats` route with 4-up stat tile grid (plays / downloads / fan-subs / revenue), "PLAYS — LAST 30 DAYS" bar chart with 7d/30d/All toggle + date axis, engagement-unit progress bars, top-tracks list, top-countries list with progress bars. Needs API endpoints: `/api/me/stats/plays`, `/api/me/stats/top-tracks`, `/api/me/stats/top-countries`. Update sidebar `#studio-stats` anchor → `/dashboard/stats` route. | Large | P1 |
| [x] | **PLAT-031** | **Smart link DSP buttons** — add service icon (emoji per platform in a 28px rounded square), action-label map (`spotify → "Stream"`, `bandcamp → "Buy / Free DL"`, `tahti → "FLAC · best quality"`), `.sl-btn--primary` modifier for the tahti.fi button (teal border highlight). Increase cover art from 160→200px. Changes in `SmartLinkDspButtons` + `brand-channel.css`. | Small | P1 |
| [x] | **PLAT-032** | **Channel public page — tag chips, release thumbnails, sticky live bar** — add `.prof-tag-chip` + `.prof-tags` pill styles for genre/tag chips; `.prof-release-row` with a 40×40 gradient thumbnail slot and "Links →" / "Play ▶" action buttons; `.ch-sticky-live-bar` fixed-bottom banner (green dot, listener count, FLAC badge, "Open →" CTA) shown when channel is live. | Medium | P1 |
| [x] | **PLAT-033** | **Dashboard overview — stat tile grid + End Broadcast CTA** — `db-stat-tiles` 4-column grid, amber End Broadcast button, `db-quick-actions` row (release, newsletter, Mixcloud, stats). | Medium | P2 |
| [x] | **PLAT-034** | **Section label consistency** — `.db-section-label` / `.ch-section-label` / `.stats-section-label` on dashboard, channel, and stats pages. | Small | P2 |
| [x] | **PLAT-035** | **Countdown timer** — `BroadcastCountdown` on channel page for scheduled next broadcast. | Small | P2 |
| [x] | **PLAT-036** | **Custom HLS player** — waveform bars, play/pause, seek bar, buffering state in `hls-player.tsx` + Three.js audio-reactive background. | Medium | P3 |
| [x] | **PLAT-037** | **Mobile player layout** — `@media (max-width: 480px)` full-bleed player card and countdown tiles in `brand-channel.css`. | Small | P3 |
| [x] | **PLAT-038** | **Stash / file manager** (`/dashboard/stash`) — `StashFile` + share links, presigned upload/download API, dashboard UI. | Large | P3 |
| [x] | **PLAT-039** | **Channel page v8 polish** — live-mode header shows `@handle` in centre (not nav); archive durations in `Xh Ym` format; CTA row ("Support directly" + "View profile →") below genre chips; `ChannelHeader` with `activeNav` used on `/listen` with its own brand-scoped layout. | Medium | P1 |

### Public pages and signup (UI-brief gap audit, 2026-06-09)

These routes are specified in `docs/UI-brief.md` but return 404 today.
All are required before public beta (1 August 2026 target).

| Done | ID | Item | Effort | Priority |
|:---:|---|---|---|---|
| [x] | **PLAT-040** | **`/about`** — three-section page: org mission + nonprofit structure, the constitution + membership model (link to `/governance`), AGPL licence commitment. Static Next.js page with `ChannelHeader` + brand-channel shell. | Small | P1 |
| [x] | **PLAT-041** | **`/for-artists`** — marketing landing page. Header + hero text; `<BrowserFrame>` carousel showing channel page / live+chat / dashboard / mobile screenshots (v8 reference images in `website/screenshots/`); three-column feature grid (broadcast, archive, grants); CTA row → `/apply`. Requires `<BrowserFrame>` component in `@tahti/ui` (see PLAT-045). | Medium | P1 |
| [x] | **PLAT-042** | **`/agpl`** — source-code disclosure page: link to the public git repo, AGPL-3.0 licence text or summary, "you can fork this" paragraph, "SaaS provider? Contact us" note. Static page in brand-channel shell. | Small | P1 |
| [x] | **PLAT-043** | **`/privacy`** — GDPR-compliant privacy policy. Data controller (Tahti ry), categories of data collected, retention periods, user rights (access / erasure), cookie usage. Must be approved by the board before public beta. | Small | P1 |
| [x] | **PLAT-044** | **`/terms`** — terms of service for artists and listeners. Artist upload licence (non-exclusive, AGPL data), prohibited content, account suspension policy, limitation of liability. Must be approved by the board before public beta. | Small | P1 |
| [x] | **PLAT-045** | **`<BrowserFrame>` component** (`@tahti/ui`) — dark rounded browser chrome (traffic-light dots, URL bar placeholder) wrapping a screenshot or slot. Used in `/for-artists` carousel and documentation pages. Pure CSS + TSX, no JS. | Small | P2 |
| [x] | **PLAT-046** | **Homepage upgrade (`/`)** — replace the minimal gateway card with the full v8 homepage: "On air right now" live channel tile grid (same data as `/listen`), stats strip (active artists, broadcasts this month, total hours), tagline + CTA to `/apply` / `/listen`. Keep the gateway redirect for non-JS as a fallback. | Medium | P2 |
| [x] | **PLAT-047** | **Self-serve artist signup flow** — open-beta multi-step wizard replacing the single `/apply` form: `/signup` (email + handle + tier), `/signup/payment` (Stripe Checkout for paid tiers, skip for free), `/signup/profile` (avatar, bio, location, genre tags), `/signup/broadcast` (stream-key display + OBS/Mixxx quickstart). Gated by `SIGNUP_OPEN=1` in production until public beta; enabled in dev by default. | Large | P1 |
| [x] | **PLAT-048** | **`/admin/grants` + `/admin/grants/:year`** — dedicated grant cycle review and distribution-approval UI. The grant engine and ledger entries exist (M9) but there is no page to browse per-artist engagement-unit breakdowns, approve the annual distribution, or download the board-approval CSV. Route is currently 404. | Medium | P1 |
| [x] | **PLAT-049** | **`/admin/agm`** — AGM planning and proposal management page. Companion to `/admin/governance/resolutions`; needs: proposal submission form, agenda builder, member-notification send action, minutes upload. Route is currently 404. | Medium | P2 |

### Website-promise gap audit (2026-06-09)

Cross-referenced the pitch site (`website/`) against the live codebase. The following promises are not yet delivered. Caddy infrastructure and DB fields exist in several cases — the gaps are in app logic or ops config.

| Status | ID | Description | Size | Priority |
|:---:|:---|---|:---:|:---:|
| [x] | **PLAT-050** | **`slug.tahti.live` subdomain routing** — Caddy already passes `X-Tahti-Channel-Slug` for every `*.tahti.live` hit, but Next.js has no middleware to read it. Add `apps/web/src/middleware.ts` that rewrites requests carrying that header to `/c/[slug]`, so `dj-moonrise.tahti.live` renders the channel page without redirecting. | Small | P1 |
| [x] | **PLAT-051** | **Custom domain self-serve (paid tier)** — Website promises "custom domain" for paid members. `Channel.customDomain` field exists in the DB but there is no: artist dashboard input to set it, DNS TXT-record verification endpoint, or Caddy admin-API call to add the route. Implement end-to-end: settings UI → `PATCH /api/me/channel` → verify TXT record → Caddy `/config` inject → on-demand TLS (already configured). | Medium | P2 |
| [x] | **PLAT-052** | **Free-tier weekly live-hour enforcement at ingest** — `@tahti/shared/broadcast-cap`, `broadcast-cap-tick` BullMQ cron, and `canAcceptSourceConnect` enforcement in both Icecast and RTMP ingest routes were fully implemented prior to this sprint. Roadmap entry corrected to reflect done status. | Small | P2 |
| [~] | **PLAT-053** | **Tahti Radio → Mixcloud Live multistream** — Blocked: no Liquidsoap `.liq` file for Tahti Radio exists in the repository. The radio service sends telnet commands to an external Liquidsoap process. Cannot add Mixcloud Live RTMP output without access to the radio config. Deferred until radio config is in-repo. | Medium | P2 |
| [x] | **PLAT-054** | **Rich Markdown bio (headings, images, embedded video)** — Website promises "Markdown-rich text. Paragraphs, headings, images, embedded video. Looks like a label site." Bio is currently rendered via `SafePlainText` (plain text + @-mention links only). Switch to a sanitised Markdown renderer (remark + rehype-sanitize) with YouTube/Vimeo oEmbed expansion; add a Markdown editor in the profile settings panel. | Medium | P2 |
| [x] | **PLAT-055** | **Storage usage on public transparency page** — Website: "We track storage and display it openly on the public dashboard. Written into the bylaws." `storageUsedBytes` is tracked per artist and returned in `/api/auth/me` but is not shown anywhere publicly. Add a platform-wide storage aggregate (sum of all `User.storageUsedBytes`) to `/transparency` alongside the ledger totals. | Small | P2 |
| [x] | **PLAT-056** | **Go-live: Revelator DSP distribution (ops)** — The full distribution pipeline is implemented (`/api/me/releases/:id/distribute`, Revelator webhook, royalty pull-back, dashboard ops panel). Blocked on: live Revelator API credentials in production config + ISRC registrar account. No code changes required — pure ops task. | Small | P1 |
| [x] | **PLAT-057** | **Go-live: Mixcloud archive upload (ops)** — One-click archive → Mixcloud push is implemented (OAuth connect, `mixcloud-upload` queue worker, `archive-mixcloud.tsx` dashboard panel). Blocked on: Mixcloud app approved for production OAuth (currently dev-tier key). No code changes required — pure ops task. | Small | P1 |
| [x] | **PLAT-058** | **Admin nav: add Grants + AGM + Vendors links** — `/admin/grants` and `/admin/agm` existed as routes but were not linked from the admin sidebar. Added all three alongside a new `/admin/settings/vendors` entry. | Small | P2 |
| [x] | **PLAT-059** | **`/admin/settings/vendors` — vendor & DPA tracking page** — Directors need a single place to see all third-party vendors (Stripe, UpCloud, Mixcloud, Revelator, Postmark, hCaptcha, AcoustID, GitHub) with their env-var requirements, portal links, and GDPR/DPA obligations. Replaces manual reference to `ops/VENDORS.md` with an in-app checklist. | Small | P2 |
| [x] | **PLAT-060** | **Roadmap hygiene: mark M15/M16/M17/M18/M24 as Done** — All five milestones were implemented but still showed 🟡 Partial in the milestone table and Phase 5/6 checklists. Corrected status after code audit confirmed full implementation. | Tiny | P3 |

### Listener geography map (PLAT-061–065)

Artists should see where in the world their music is being listened to — a choropleth world map on the dashboard stats tab showing listener counts by country. Data comes from two sources: archive download events (already have `byIpHash`) and HLS live-listener events (Caddy log worker). Neither currently stores country codes; full implementation requires geolocation infrastructure, schema changes, a new API endpoint, and the map UI.

| Status | ID | Description | Size | Priority |
|:---:|:---|---|:---:|:---:|
| [x] | **PLAT-061** | **IP geolocation infrastructure** — Add `geoip-lite` (bundles MaxMind GeoLite2 Country data, no external API, country-level only) to `apps/api`. Create `src/lib/geoip.ts` with `countryFromIp(ip: string): string \| null` that handles IPv4, IPv4-mapped IPv6, and returns `null` for private/loopback ranges. Register `MAXMIND_LICENSE_KEY` env var stub in docker-compose for future DB update automation. | Small | P2 |
| [x] | **PLAT-062** | **Geo-enrich archive download events** — Add `countryCode String?` field to the `Download` Prisma model (migration). In the download recording handler, extract the real client IP from `X-Forwarded-For` before hashing, call `countryFromIp`, store the result. Update `buildArtistPlaysStats` to return a country breakdown for the downloads series. | Small | P2 |
| [x] | **PLAT-063** | **HLS live listener geo aggregates** — In the Caddy log-parsing worker cron that writes `hlsListenersRedisKey`, also write per-country daily counts as a Redis hash `hls:listener-geo:{slug}:{date}` → `{countryCode: count}` with an 8-day TTL. Expose via a new `fetchMeasuredHlsListenersByCountry(slug, dates)` helper. | Small | P2 |
| [x] | **PLAT-064** | **Listener geography API endpoint** — `GET /api/me/listener-geo?period=7d\|30d\|all` aggregates `Download.countryCode` counts for the artist's channel plus Redis HLS geo hashes. Returns `[{countryCode, displayName, count}]` sorted by count descending. Backed by `geoip-lite`'s country name lookup for `displayName`. | Small | P2 |
| [x] | **PLAT-065** | **Listener map dashboard panel** — Add `react-simple-maps` to `apps/web`. Build `ListenerMapPanel` client component: fetches `/api/me/listener-geo`, renders a choropleth SVG world map with linear colour scale (low → `--accent`), hover tooltip showing country name + count, and a ranked list of top 10 countries beneath the map. Add as a new card in the dashboard stats tab. | Medium | P2 |

### Audio editor: remaining DSP (PLAT-066–069)

The editor v0 (trim/fade), v1 (multitrack), and v2 (LUFS + limiter) are all shipped. The full `docs/audio-editor.md` baseline additionally specifies per-track EQ, compressor, HP/LP filters, and publishing a bounced result directly to a release track. All shipped (2026-06-11): 3-band shelving/peaking EQ (±12dB), HP/LP filters, and an `acompressor` toggle in the bounce worker, surfaced as an "EQ & dynamics" section in the trim editor; plus a "Publish to release" action that sends the active (or a chosen) archive version to a release track via `transcode-release-track`.

| Status | ID | Description | Size | Priority |
|:---:|:---|---|:---:|:---:|
| [x] | **PLAT-066** | **Parametric EQ + HP/LP in bounce worker** — Extend `buildAudioFilters` in `apps/worker/src/jobs/bounce-archive-edit.ts` to accept an `eq` config: `[{freq, gain, q}]` array for FFmpeg `equalizer` biquad filters, plus optional `highpassHz` and `lowpassHz` fields mapped to `highpass=f=…` / `lowpass=f=…`. Add corresponding fields to the `BounceArchiveEditJob` payload schema and `queue.ts` type. | Small | P2 |
| [x] | **PLAT-067** | **Compressor in bounce worker** — Add optional `compressor: {thresholdDb, ratio, attackMs, releaseMs, makeupGainDb}` to the bounce job payload; map to FFmpeg `acompressor` filter in `buildAudioFilters`. Extend the archive editor API route (`/api/me/archive/:id/bounce`) to accept and pass through the new compressor params. | Small | P2 |
| [x] | **PLAT-068** | **EQ + compressor UI in archive trim editor** — Add collapsible "EQ & dynamics" section to `archive-trim-editor.tsx`: 3-band shelving EQ (low shelf, mid peak, high shelf) with gain sliders (±12 dB), HP/LP frequency inputs, and a compressor toggle with threshold/ratio/attack/release inputs. Wire to the bounce call. Mark M21 audio spec "EQ + compressor" acceptance criterion as met. | Medium | P2 |
| [x] | **PLAT-069** | **Bounce → release track publish path** — The bounce worker currently saves back to archive only. Add a `destination: 'archive' \| 'release-track'` field to the bounce job; when `release-track`, create a new `ReleaseTrack` version with the bounced file (reusing the M28 version-history path). Expose a "Publish to release" button in the trim editor that prompts for a release selection. Completes the full M21 acceptance criterion ("publish as a release track"). | Medium | P2 |

### Listener geography map (PLAT-061–065)

Artists should see where in the world their music is being listened to — a choropleth world map on the dashboard stats tab showing listener counts by country. Data comes from two sources: archive download events (already have `byIpHash`) and HLS live-listener events (Caddy log worker). Neither currently stores country codes; full implementation requires geolocation infrastructure, schema changes, a new API endpoint, and the map UI.

| Status | ID | Description | Size | Priority |
|:---:|:---|---|:---:|:---:|
| [x] | **PLAT-061** | **IP geolocation infrastructure** — Add `geoip-lite` (bundles MaxMind GeoLite2 Country data, no external API, country-level only) to `apps/api`. Create `src/lib/geoip.ts` with `countryFromIp(ip: string): string \| null` that handles IPv4, IPv4-mapped IPv6, and returns `null` for private/loopback ranges. Register `MAXMIND_LICENSE_KEY` env var stub in docker-compose for future DB update automation. | Small | P2 |
| [x] | **PLAT-062** | **Geo-enrich archive download events** — Add `countryCode String?` field to the `Download` Prisma model (migration). In the download recording handler, extract the real client IP from `X-Forwarded-For` before hashing, call `countryFromIp`, store the result. Update `buildArtistPlaysStats` to return a country breakdown for the downloads series. | Small | P2 |
| [x] | **PLAT-063** | **HLS live listener geo aggregates** — In the Caddy log-parsing worker cron that writes `hlsListenersRedisKey`, also write per-country daily counts as a Redis hash `hls:listener-geo:{slug}:{date}` → `{countryCode: count}` with an 8-day TTL. Expose via a new `fetchMeasuredHlsListenersByCountry(slug, dates)` helper. | Small | P2 |
| [x] | **PLAT-064** | **Listener geography API endpoint** — `GET /api/me/listener-geo?period=7d\|30d\|all` aggregates `Download.countryCode` counts for the artist's channel plus Redis HLS geo hashes. Returns `[{countryCode, displayName, count}]` sorted by count descending. Backed by `geoip-lite`'s country name lookup for `displayName`. | Small | P2 |
| [x] | **PLAT-065** | **Listener map dashboard panel** — Add `react-simple-maps` to `apps/web`. Build `ListenerMapPanel` client component: fetches `/api/me/listener-geo`, renders a choropleth SVG world map with linear colour scale (low → `--accent`), hover tooltip showing country name + count, and a ranked list of top 10 countries beneath the map. Add as a new card in the dashboard stats tab. | Medium | P2 |

### Audio editor: remaining DSP (PLAT-066–069)

The editor v0 (trim/fade), v1 (multitrack), and v2 (LUFS + limiter) are all shipped. The full `docs/audio-editor.md` baseline additionally specifies per-track EQ, compressor, HP/LP filters, and publishing a bounced result directly to a release track. All shipped (2026-06-11): 3-band shelving/peaking EQ (±12dB), HP/LP filters, and an `acompressor` toggle in the bounce worker, surfaced as an "EQ & dynamics" section in the trim editor; plus a "Publish to release" action that sends the active (or a chosen) archive version to a release track via `transcode-release-track`.

| Status | ID | Description | Size | Priority |
|:---:|:---|---|:---:|:---:|
| [x] | **PLAT-066** | **Parametric EQ + HP/LP in bounce worker** — Extend `buildAudioFilters` in `apps/worker/src/jobs/bounce-archive-edit.ts` to accept an `eq` config: `[{freq, gain, q}]` array for FFmpeg `equalizer` biquad filters, plus optional `highpassHz` and `lowpassHz` fields mapped to `highpass=f=…` / `lowpass=f=…`. Add corresponding fields to the `BounceArchiveEditJob` payload schema and `queue.ts` type. | Small | P2 |
| [x] | **PLAT-067** | **Compressor in bounce worker** — Add optional `compressor: {thresholdDb, ratio, attackMs, releaseMs, makeupGainDb}` to the bounce job payload; map to FFmpeg `acompressor` filter in `buildAudioFilters`. Extend the archive editor API route (`/api/me/archive/:id/bounce`) to accept and pass through the new compressor params. | Small | P2 |
| [x] | **PLAT-068** | **EQ + compressor UI in archive trim editor** — Add collapsible "EQ & dynamics" section to `archive-trim-editor.tsx`: 3-band shelving EQ (low shelf, mid peak, high shelf) with gain sliders (±12 dB), HP/LP frequency inputs, and a compressor toggle with threshold/ratio/attack/release inputs. Wire to the bounce call. Mark M21 audio spec "EQ + compressor" acceptance criterion as met. | Medium | P2 |
| [x] | **PLAT-069** | **Bounce → release track publish path** — The bounce worker currently saves back to archive only. Add a `destination: 'archive' \| 'release-track'` field to the bounce job; when `release-track`, create a new `ReleaseTrack` version with the bounced file (reusing the M28 version-history path). Expose a "Publish to release" button in the trim editor that prompts for a release selection. Completes the full M21 acceptance criterion ("publish as a release track"). | Medium | P2 |

### Listener geography map (PLAT-061–065)

Artists should see where in the world their music is being listened to — a choropleth world map on the dashboard stats tab showing listener counts by country. Data comes from two sources: archive download events (already have `byIpHash`) and HLS live-listener events (Caddy log worker). Neither currently stores country codes; full implementation requires geolocation infrastructure, schema changes, a new API endpoint, and the map UI.

| Status | ID | Description | Size | Priority |
|:---:|:---|---|:---:|:---:|
| [x] | **PLAT-061** | **IP geolocation infrastructure** — Add `geoip-lite` (bundles MaxMind GeoLite2 Country data, no external API, country-level only) to `apps/api`. Create `src/lib/geoip.ts` with `countryFromIp(ip: string): string \| null` that handles IPv4, IPv4-mapped IPv6, and returns `null` for private/loopback ranges. Register `MAXMIND_LICENSE_KEY` env var stub in docker-compose for future DB update automation. | Small | P2 |
| [x] | **PLAT-062** | **Geo-enrich archive download events** — Add `countryCode String?` field to the `Download` Prisma model (migration). In the download recording handler, extract the real client IP from `X-Forwarded-For` before hashing, call `countryFromIp`, store the result. Update `buildArtistPlaysStats` to return a country breakdown for the downloads series. | Small | P2 |
| [x] | **PLAT-063** | **HLS live listener geo aggregates** — In the Caddy log-parsing worker cron that writes `hlsListenersRedisKey`, also write per-country daily counts as a Redis hash `hls:listener-geo:{slug}:{date}` → `{countryCode: count}` with an 8-day TTL. Expose via a new `fetchMeasuredHlsListenersByCountry(slug, dates)` helper. | Small | P2 |
| [x] | **PLAT-064** | **Listener geography API endpoint** — `GET /api/me/listener-geo?period=7d\|30d\|all` aggregates `Download.countryCode` counts for the artist's channel plus Redis HLS geo hashes. Returns `[{countryCode, displayName, count}]` sorted by count descending. Backed by `geoip-lite`'s country name lookup for `displayName`. | Small | P2 |
| [x] | **PLAT-065** | **Listener map dashboard panel** — Add `react-simple-maps` to `apps/web`. Build `ListenerMapPanel` client component: fetches `/api/me/listener-geo`, renders a choropleth SVG world map with linear colour scale (low → `--accent`), hover tooltip showing country name + count, and a ranked list of top 10 countries beneath the map. Add as a new card in the dashboard stats tab. | Medium | P2 |

### Audio editor: remaining DSP (PLAT-066–069)

The editor v0 (trim/fade), v1 (multitrack), and v2 (LUFS + limiter) are all shipped. The full `docs/audio-editor.md` baseline additionally specifies per-track EQ, compressor, HP/LP filters, and publishing a bounced result directly to a release track. All shipped (2026-06-11): 3-band shelving/peaking EQ (±12dB), HP/LP filters, and an `acompressor` toggle in the bounce worker, surfaced as an "EQ & dynamics" section in the trim editor; plus a "Publish to release" action that sends the active (or a chosen) archive version to a release track via `transcode-release-track`.

| Status | ID | Description | Size | Priority |
|:---:|:---|---|:---:|:---:|
| [x] | **PLAT-066** | **Parametric EQ + HP/LP in bounce worker** — Extend `buildAudioFilters` in `apps/worker/src/jobs/bounce-archive-edit.ts` to accept an `eq` config: `[{freq, gain, q}]` array for FFmpeg `equalizer` biquad filters, plus optional `highpassHz` and `lowpassHz` fields mapped to `highpass=f=…` / `lowpass=f=…`. Add corresponding fields to the `BounceArchiveEditJob` payload schema and `queue.ts` type. | Small | P2 |
| [x] | **PLAT-067** | **Compressor in bounce worker** — Add optional `compressor: {thresholdDb, ratio, attackMs, releaseMs, makeupGainDb}` to the bounce job payload; map to FFmpeg `acompressor` filter in `buildAudioFilters`. Extend the archive editor API route (`/api/me/archive/:id/bounce`) to accept and pass through the new compressor params. | Small | P2 |
| [x] | **PLAT-068** | **EQ + compressor UI in archive trim editor** — Add collapsible "EQ & dynamics" section to `archive-trim-editor.tsx`: 3-band shelving EQ (low shelf, mid peak, high shelf) with gain sliders (±12 dB), HP/LP frequency inputs, and a compressor toggle with threshold/ratio/attack/release inputs. Wire to the bounce call. Mark M21 audio spec "EQ + compressor" acceptance criterion as met. | Medium | P2 |
| [x] | **PLAT-069** | **Bounce → release track publish path** — The bounce worker currently saves back to archive only. Add a `destination: 'archive' \| 'release-track'` field to the bounce job; when `release-track`, create a new `ReleaseTrack` version with the bounced file (reusing the M28 version-history path). Expose a "Publish to release" button in the trim editor that prompts for a release selection. Completes the full M21 acceptance criterion ("publish as a release track"). | Medium | P2 |

### Channel & release visual customization (PLAT-070–076)

Artists want to personalize their channel and release pages with Three.js/WebGL visualizations, cover-art-derived color palettes, and backdrop slideshow preset themes. Color extraction runs automatically from cover art at transcode time; artists can override at channel or release level via the dashboard. Three.js presets are client-side only — no server rendering. Extends M24 per-content visuals and M26 backdrop/gallery themes.

| Status | ID | Description | Size | Priority |
|:---:|:---|---|:---:|:---:|
| [x] | **PLAT-070** | **Cover art palette extraction** — `node-vibrant` on release artwork upload complete; `Release.paletteJson`; auto-default `colorSchemeJson` when no override. | Small | P2 |
| [x] | **PLAT-071** | **Color scheme model + API** — `colorSchemeJson` on Channel/Release; visual PATCH routes; resolved `colorScheme` in channel + smart-link API responses. | Small | P2 |
| [x] | **PLAT-072** | **Three.js visualization preset system** — `VisualPreset` enum + Five Three.js presets; audio-reactive waveform/grid via `AnalyserNode` on archive playback. | Medium | P2 |
| [x] | **PLAT-073** | **Channel visual preset picker in dashboard** — Thumbnail grid with live mini-canvas previews + color palette editor + slideshow controls. | Medium | P2 |
| [x] | **PLAT-074** | **Per-release/archive visual preset + color override** — Release and archive dashboard panels; archive preset active during playback on `/c/:slug`. | Small | P2 |
| [x] | **PLAT-075** | **Backdrop slideshow preset themes** — CSS-animation presets + dashboard interval/transition/autoplay controls; reduced-motion pauses transitions. | Small | P2 |
| [x] | **PLAT-076** | **Public rendering on `/c/:slug` and `/r/:slug`** — `[data-channel-root]` CSS tokens, lazy-loaded presets, WebGL fallback, reduced-motion support. | Medium | P2 |

### UX audit — nav consistency & feature linking (2026-06-11) (PLAT-077)

| Done | ID | Item | Effort | Priority |
|:---:|---|---|---|---|
| [x] | **PLAT-077** | **Site-wide footer + consistent public-page nav** — New `PublicFooter` (`packages/ui/src/brand/PublicFooter.tsx`) with links to For artists / About / Venues / Governance / Transparency / Privacy / Terms / AGPL source / Status, added to all `(info)` pages, `/governance`, `/transparency`, `/status`, `/help/*`, `/v/:slug`, `/venues`, and the homepage. `PublicBrandShell` gained `showHeader`/`showFooter`/`user`/`statusUrl` props so previously chrome-less pages (`/governance`, `/transparency`, `/status`, `/help/*`, `/v/:slug`) now get the same `ChannelHeader` site nav as `/about`/`/venues`/`/for-artists`. Removed dead `SiteFooter` (`packages/ui/src/admin/site-footer.tsx`, zero usages). Fixed broken `/dashboard/upgrade` link → `/help/tier-limits` (`custom-domain-panel.tsx`). Added `/help` index page and linked the previously-orphaned `/help/support` from the dashboard stream-settings panel. | Medium | P1 |

---

### Archive uploads — preserve source quality, no upscaling (2026-06-11) (PLAT-078)

| Status | ID | Description | Size | Priority |
|:---:|:---|---|:---:|:---:|
| [x] | **PLAT-078** | **Detect and preserve source audio quality on archive upload** — `/api/uploads/*` and version re-uploads already accepted MP3/AAC/M4A/FLAC/WAV/AIFF (`audio/*`), but lossy sources were always re-encoded to a fixed 192kbps MP3, which both upscaled lower-bitrate uploads and degraded higher-bitrate ones. The transcode worker (`transcode.ts`, `transcode-version.ts`) now ffprobes the source codec + bitrate, stores `ArchiveItem.sourceFormat`/`sourceBitrateKbps` (and the same on `ArchiveItemVersion`, synced via `ensureInitialVersion`/`syncActiveVersionToItem`), and picks an MP3 output bitrate via `chooseLossyOutputBitrateKbps()` (`packages/shared/src/archive-playback.ts`) that never exceeds the source bitrate (no upscaling) and never re-encodes a higher-bitrate source down to 192k (no quality loss). Lossless detection now also checks the audio codec (`isLosslessCodec`: FLAC/ALAC/PCM), so ALAC-in-M4A is kept lossless. Detected source format/bitrate is shown to artists in the archive item editor and per-version list (e.g. "Source: MP3 192 kbps" / "FLAC (lossless)"). | Medium | P1 |

### Channel appearance editor — website mockup parity (2026-06-05) (PLAT-079)

Cross-referenced the **Channel appearance** slide in `website/index.html` (`#mock-visual`) against the live dashboard. M31 (PLAT-070–076) already shipped the backend and public rendering; this sprint closes the remaining UX gaps so artists can style their channel from one place in the studio.

| Status | ID | Description | Size | Priority |
|:---:|:---|---|:---:|:---:|
| [x] | **PLAT-079** | **Channel appearance editor (dashboard)** — Broadcast tab → **Channel appearance** (`#channel-appearance`, open by default): gallery mode + image URLs + video backdrop (`PATCH /api/me/channel/gallery`), CSS text-layer effects (`PATCH /api/me/channel/text-layer`), and visual style panel matching the website mockup — WebGL preset thumbnail grid with live mini-canvas, custom 5-color palette override, slideshow transition picker (Fade / Zoom / Pan / Blur cross) with interval + speed sliders, autoplay toggle (`PATCH /api/me/channel/visual`). **Preview channel →** opens `/c/:slug` in a new tab. Studio-dark UI on all three panels (no admin light-theme leakage). E2E manifest entry: `artist/channel-appearance.png` → `/dashboard#broadcast`. Website reference: `website/index.html` mockup tab **Visual preset**. | Medium | P2 |

### Security, UX & performance audit (2026-06-05)

Cross-cutting audit of auth, studio UX, and dashboard/API performance. Items marked `[x]` were implemented in the same sprint; others remain backlog.

#### Security (SEC)

| Status | ID | Description | Priority |
|:---:|:---|---|:---:|
| [x] | **SEC-001** | **Block public `/internal/*` ingest callbacks** — Caddy `respond 403` on `api.tahti.live/internal/*`; API hook rejects non-private IPs without `Bearer INTERNAL_SECRET`. Prevents forced stream disconnect via `on_disconnect` / `on_done`. | P0 |
| [x] | **SEC-002** | **Stash upload objectKey ownership** — `POST /api/me/stash` rejects keys not under `stash/{userId}/`. | P1 |
| [x] | **SEC-003** | **Mixcloud OAuth CSRF `state`** — authorize URL + callback cookie validation (SoundCloud/Bandcamp pattern). | P1 |
| [x] | **SEC-004** | **Stripe webhook fail-closed in production** — refuse unsigned payloads when `STRIPE_WEBHOOK_SECRET` unset in prod. | P1 |
| [x] | **SEC-005** | **Production secret validation at startup** — fail boot when `INTERNAL_SECRET`, `DOCS_PASS`, or `HCAPTCHA_SECRET` retain dev defaults. | P1 |
| [x] | **SEC-006** | **`videoBackgroundUrl` CSS injection** — HTTPS allowlist + safe `url()` encoding on `/c/:slug`. | P2 |
| [ ] | **SEC-007** | **Centrifugo publish proxy auth** — verify proxy signature or restrict `/api/chat/message` to internal network. | P2 |
| [ ] | **SEC-008** | **Caddy HSTS + baseline CSP** on `app.tahti.live` / `api.tahti.live`. | P2 |
| [x] | **SEC-009** | **Restrict `/metrics`** to internal scrape network or token. | P2 |
| [ ] | **SEC-010** | **Session revocation on login** — delete other sessions when password/login succeeds. | P3 |

#### UX (UX)

| Status | ID | Description | Priority |
|:---:|:---|---|:---:|
| [x] | **UX-001** | **Mobile nav Revenue → `/dashboard/revenue`** (was mislabeled, opened `#newsletter`). | P0 |
| [x] | **UX-002** | **Dead help links** — `/for-artists`, `/help/broadcast` on dashboard overview. | P0 |
| [x] | **UX-003** | **`#collections` hash routing** — unique section key + catalog tab scroll. | P1 |
| [x] | **UX-004** | **Focus-visible rings + reduced-motion** on studio buttons/tabs/live dots. | P1 |
| [ ] | **UX-005** | **`studio-btn-*` → `ui-btn` sweep** — moderators, multistream, pro editor, upload flows (~15 files). | P1 |
| [ ] | **UX-006** | **Panel wrappers** — Mixcloud, Tahti Radio, moderators, overview sub-sections. | P2 |
| [ ] | **UX-007** | **Form labels + empty states** — fan tier creator, announcements, moderators add form. | P2 |
| [x] | **UX-008** | **Mobile nav** — add Upload + Collections routes. | P2 |

#### Performance (PERF)

| Status | ID | Description | Priority |
|:---:|:---|---|:---:|
| [x] | **PERF-001** | **Parallelize dashboard SSR fetches** — single `Promise.all` after `/api/auth/me`. | P0 |
| [x] | **PERF-002** | **DB indexes** — `Channel.state`, `Download(channelId, createdAt)`. | P1 |
| [x] | **PERF-003** | **Code-split `ArchiveEditor`** on dashboard via `next/dynamic`. | P1 |
| [x] | **PERF-004** | **Remove duplicate `/api/auth/me`** — layout vs page double-fetch. | P1 |
| [ ] | **PERF-005** | **SQL aggregation for funnel/egress stats** — replace `findMany` + JS bucketing. | P1 |
| [ ] | **PERF-006** | **Tab-lazy dashboard data** — don't fetch broadcast/catalog payloads on overview-only visits. | P2 |
| [ ] | **PERF-007** | **Visual preset picker** — static thumbnails; one WebGL preview for selected preset only. | P2 |
| [ ] | **PERF-008** | **Paginate** releases, stash, newsletter drafts, programme list endpoints. | P2 |

---

## Streaming infrastructure backlog

Issues identified from streaming architecture review and user journey analysis. See `docs/technical/streaming-architecture.md` for full context.

### CRITICAL — blocks horizontal scaling

| ID | Issue | Raised by | Phase to fix |
|:---|---|---|---|
| [x] | **STREAM-001** HLS segments written to shared Docker volume instead of MinIO — prevents adding a second Caddy or worker node | `hls-minio-sync` cron mirrors volume → `hls-live`; Caddy serves MinIO; watchdog uses slug prefix | M3 |
| [x] | **STREAM-004** Recording is a Liquidsoap sidecar — recording lost if Liquidsoap crashes mid-broadcast | ffmpeg recorder sidecar (RTMP/Icecast input); Liquidsoap WAV removed; finalize prefers `broadcast-{id}.wav` | M3 |
| [x] | **STREAM-005** No per-channel health watchdog — silent/frozen channels go undetected until user reports | `channel-watchdog` worker cron + orchestrator `/restart` when segments stale | M3 |

### HIGH — breaks artist or listener experience

| ID | Issue | Raised by | Phase to fix |
|:---|---|---|---|
| [x] | **STREAM-002** No edge encoder tier — Liquidsoap receives raw RTMP/Icecast directly, preventing quality normalization and independent restart recovery | Per-channel **ffmpeg edge encoder** (orchestrator-spawned) + dual-bitrate HLS (`stream-mp3-192` / `stream-flac`); Icecast bypasses edge tier | M3 |
| [x] | **STREAM-003** Ingest DNS failover has 30s dead window — OBS connections to failed ingest node must manually reconnect | Health-ranked fallbacks + prod replicas + `ops/ingest-dns.md` (TTL 5–30s) | M3 / Phase 4 |
| [x] | **ARTIST-001** OBS disconnect during broadcast does not produce partial recording — total loss if disconnect before graceful end | `finalize-broadcast-recording` on RTMP/Icecast disconnect → MinIO → `archive-broadcast`; stack `tahti_stack_recordings` volume | M4 |
| [x] | **ARTIST-002** Stream key rotation requires going offline — no hot-rotation while live | Hot rotation while `LIVE`: previous RTMP/Icecast credential valid 24h; offline rotation clears previous | M3 |
| [x] | **OPS-002** DB migration is a manual step after deploy — must be automated in CI before service update | `db-migrate-deploy.sh` in staging + prod deploy workflow; `make deploy` when `DATABASE_URL` set | M0 |
| [x] | **ARTIST-003** Liquidsoap archive fallback has no warm-up period — first listener after offline transition may get buffer-empty | `delay(3.)` on archive branch before live fallback | M3 |
| [x] | **LISTENER-001** Mobile listener on slow 4G: HLS segment interval (3s) with 6–9s buffer means 10–15s initial load — needs explicit buffering indicator | Live player shows “Buffering live stream…” (`hls-player.tsx`) | M3 |
| [x] | **LISTENER-002** No "artist coming back soon" signal — listener who tunes in during offline period has no indication when next broadcast is | API + dashboard schedule panel + public `/c/:slug` banner | M5 |

### MEDIUM — affects operations and cost attribution

| ID | Issue | Raised by | Phase to fix |
|:---|---|---|---|
| [x] | **STREAM-006** No per-channel bandwidth accounting — can't attribute egress costs per artist, can't inform resource limits or grant calculations | `GET /api/me/channel-egress` + dashboard 30d chart (downloads + live HLS from **Caddy access logs** via Redis; bitrate estimate fallback) | M8 |
| [x] | **STREAM-007** Single Icecast node — Mixxx/Traktor users have no failover | Health-ranked fallbacks + **prod `icecast-b`** + Caddy `ingest-icecast-b.tahti.live` | Phase 5 / pre-launch |
| [x] | **STREAM-008** chromaprint fingerprint runs post-broadcast only — real-time tracklist UX requires at-ingest fingerprinting | Ingest sidecar + live tracklist + AcoustID; **ACRCloud deferred** until post-production (`ACRCLOUD_ENABLED`) | M4 |
| [x] | **STREAM-009** Liquidsoap archive fallback reads MinIO cold on each segment — no local cache means repeated round-trips to MinIO for popular archive items | Worker syncs fallback pool → shared `/archive-cache`; Liquidsoap prefers local M3U | M3 |
| [x] | **OPS-001** No structured log correlation across edge encoder → Liquidsoap → recording containers for a single broadcast session | `broadcastSessionId` on ingest, orchestrator, watchdog, finalize, archive jobs | M11 |
| [x] | **OPS-002** DB migration is a manual step after deploy — must be automated in CI before service update | `db-migrate-deploy.sh` in staging + prod GitHub deploy workflow | M0 |

### LOW — improvements for polish

| ID | Issue | Raised by | Phase to fix |
|:---|---|---|---|
| [x] | **STREAM-010** Graceful drain on Liquidsoap stop may emit an incomplete final HLS segment — listeners hear a cut instead of a fade | Telnet `graceful_shutdown` fades `radio_out` before exit; `docker stop -t 20` backstop (#80) | M3 |
| [x] | **ARTIST-004** Upload progress bar shows browser→MinIO upload only, not transcode progress — artist thinks "nothing is happening" during transcode | Dashboard polls archive status after upload with transcoding progress (`upload-form.tsx`) | M2 |
| [x] | **LISTENER-003** Anonymous listener sets a handle in localStorage but it resets if cookies cleared — confusing return identity | `tahti_chat_handle` cookie + localStorage sync on load | M5 |
| [x] | **DIRECTOR-001** Grant calculation preview has no anomaly detection — director must manually spot-check 200 rows for bot activity | API preview + board UI on `/governance` | M9 |

---

## Quick reference — doc map

| Question | Read |
|---|---|
| What to build? | `AGENT.md` (M0–M20) |
| How much money? | `financial-model.md` |
| Which grants? | `funding-strategy.md` |
| Who owns the org? | `governance-and-legal.md`, `strategy-and-product.md` |
| How do grants to artists work? | `engagement-and-fansubs.md` |
| Gaps vs hearthis.at? | `competitive-gaps-hearthis.md` |
| Release ops (MusicBrainz, ISRC, checklist)? | `AGENT.md` §M30, [Phase 6b](#phase-6b--release-ops--catalog-metadata-m30) |
| How to broadcast? | `guides/for-streamers.md` + `obs-and-broadcasting-guides.md` |
| Plain-language guides (artist / viewer / streamer) | `guides/README.md` |
| Infra choices? | `infra-strategy.md` |
| How to scale nodes? | `scaling-node-distribution.md`, `infra/docker-compose.stack.yml` |
| E2E screenshots / flows? | `user-flows.md`, `e2e-screenshots/README.md` |
| Platform hardening backlog? | [Platform engineering backlog](#platform-engineering-backlog), `future-improvements.md` |
| UI / design alignment? | [UI / Design alignment](#ui--design-alignment-reference-mockup-parity), `docs/reference-screenshots/` |
| Backup & restore flow? | `technical/phase-3.md`, [Phase 2b](#phase-2b--backup--disaster-recovery-before-public-beta) |
| Ops journeys (restore drill)? | `technical/journey-ops.md` |

---

## Issue labels (for GitHub Projects)

- `legal` · `grant` · `infra` · `backup` · `milestone/M*` · `test` · `beta` · `handover` · `ops`

Create one issue per milestone sub-task or per checkbox row as you begin execution.
