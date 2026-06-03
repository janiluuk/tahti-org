# Tahti — project roadmap & handover checklist

Master task list to go from **documentation package → funded nonprofit → working
platform → tested beta → operation by Tahti ry** (with trained member-operators).

**Status today (updated 2026-06-03):** specs, infra templates, and financial
model exist **and the application code is well underway**. The MVP broadcasting
stack (M0–M6), live chat (M5), transparency ledger (M8), annual grant engine (M9),
member governance (M10), download engagement units (M18 core), fan-to-artist
subscriptions (M19 core), hardening exports (M11 partial), artist profiles +
releases (M12 partial), newsletter/embed/mentions/radio/venues (M13–M17 partial),
archive metadata + collections (M22–M23 partial), and tier gating (M20 partial)
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
| **M1** Accounts + membership | 🟡 Partial | Email/password signup, email verify, sessions; verify → `PENDING_PAYMENT`; `POST /api/me/membership/checkout` (Stripe Checkout via REST when configured, dev-direct otherwise); webhook `checkout.session.completed` → `REVENUE_SUBSCRIPTION` ledger + `isMember` + member number; **`POST /api/me/membership/portal`** + dashboard “Manage billing” when Stripe configured; board CSV export; **renewal reminder** + **membership lapse** worker crons (~30d before expiry, 365d ARTIST tier). Deferred: Stripe subscription renewal (annual manual renew path) |
| **M2** Channel + archive upload | ✅ Done | Presigned S3-multipart upload (resolves Topic 5 → option A), transcode worker, channel page |
| **M3** Live ingress + orchestrator | ✅ Done | Icecast + RTMP webhooks, orchestrator + Liquidsoap template, HLS player. Path-based routing `/c/<slug>` (resolves Topic 9 → option B/C). WebRTC browser-live deferred (Topic 6) |
| **M4** Auto-archive | ✅ Done | `archive-broadcast` worker finalizes live recordings into archive items |
| **M5** Live chat | ✅ Done | Centrifugo token/message/announcements/ban + reactions + presence |
| **M6** Multistream RTMP | ✅ Done | Per-channel targets, encrypted stream keys, `alwaysMirror` gated to STUDIO |
| **M7** Distribution (Mixcloud + Revelator) | 🟡 Partial | Mixcloud OAuth connect + archive upload queue; `packages/revelator` stub/live submit + **Revelator wizard** in release ops (pre-fills catalog). Deferred: royalty sync cron, tiered €8/release billing, Mixcloud OAuth in production credentials |
| **M8** Transparency ledger | ✅ Done | Append-only ledger, monthly rollup worker, public `/transparency` API + `/transparency/grants/:year` report |
| **M9** Annual grant calc | ✅ Done | `packages/ledger`: pure largest-remainder `allocateGrants` + `runAnnualGrantCalc` (reads rollups + counted downloads), `GrantDisbursement` model, `GRANT_DISBURSEMENT`/`RESERVE_TRANSFER` ledger entries, March-1 cron, board run + artist/public report endpoints. Fan-sub euro input lands with M19 |
| **M10** Member governance | ✅ Done | `Motion`/`Vote` models, `requireMember`/`requireBoard` guards, advisory voting (Topic 11), members `/governance` portal, tally hidden until close |
| **M11** Hardening | 🟡 Partial | Rate limiting, hCaptcha (register + **chat token → first message** via Redis), audit log, `/api/v1/status`, admin CSV exports, **OpenAPI/Swagger** (`/docs`, basic-auth), shared `lib/csv.ts`, **structured request logging**, **Stripe webhook failure counters** on `/metrics`, **Upptime config** (`ops/upptime/`). Deferred: live Upptime deploy, **backup/DR drills** (see [Phase 2b](#phase-2b--backup--disaster-recovery-before-public-beta)) |
| **M12** Profile + releases | 🟡 Partial | Release CRUD, smart links, DSP editor, **profile playback** (`archiveItemId` + `streamKey` presign); **cover art upload to MinIO** (`artworkKey` + presigned URLs). Deferred: bulk import |
| **M13** Newsletter | 🟡 Partial | `newsletter` schema (Subscriber/Draft/Send), double opt-in (`/api/newsletter/subscribe`, `/confirm/:token`, `/unsubscribe/:token`), artist draft + send endpoints, `newsletter-dispatch` worker (batched, List-Unsubscribe header), per-tier rate limit (1/4/∞ per week). Deferred: SES for broadcast sends (uses Postmark/SMTP for now), bounce webhook handler |
| **M14** Embed/promo | 🟡 Partial | `GET /oembed`, embed API + play URL, embed pages; **smart-link view counts** on `/r/:slug` + dashboard. Deferred: social auto-post |
| **M24** Per-content visuals | 🟡 Partial | Channel gallery + **channel video backdrop** + per-item banner/background/slideshow on `/c/:slug`; **YouTube/Vimeo** via `parseVideoEmbedUrl` |
| **M15** Artist @-mentions | ✅ Done | `lib/mentions.ts`, bio/announcement hooks, mute + settings API |
| **M16** Tahti Radio meta-stream | ✅ Done | `services/tahti-radio`, `GET /api/v1/radio` proxy |
| **M17** Venue calendar | 🟡 Partial | Venue API + iCal; board verify API + **`/governance/venues`** admin UI |
| **M18** Downloads first-class | 🟡 Partial | Archive + **release-track** downloads (dedup, rate limit, fan-sub 5×, **FLAC for paid artists + fan subs**, **source for fan subs**), 24h net-new-IP threshold; **download-fraud-scan** cron; **Tor/datacenter CIDR + bot UA** do not count (`DOWNLOAD_NO_COUNT_CIDRS`, trust overrides); **daily Tor exit sync** (worker → Redis + bundled list via `scripts/sync-tor-exit-list.mjs`). Deferred: ops cron for bundled file refresh in deploy |
| **M19** Fan-subs | 🟡 Partial | Tiers, Connect + Checkout, webhook lifecycle, ledger split, perk codes (`FAN_CHAT`, `FAN_NEWSLETTER`), fan chat/newsletter gates, **Stripe transfer retry** (`packages/ledger`), payout dashboard + `GET /api/me/fan-sub-payouts`, **subscriber CSV export** (`GET /api/me/fan-subscribers/export.csv`). Deferred: automated deletion workflow UI |
| **M22** Archive metadata | 🟡 Partial | Metadata editor + tracklist @tags; auto tags; lossless→FLAC; **follow/repost download gates** + per-item gate stats + **channel funnel** (`GET /api/me/channel-funnel-stats` + split endpoints; 14-day charts). Deferred: per-listener HLS metrics |
| **M23** Collections + RSS | 🟡 Partial | Schema + API CRUD, public JSON/RSS, featured collections, reorder API + **drag-and-drop** in dashboard |
| **M28** Track version history | 🟡 Partial | Archive + **release-track** version history (upload/activate, worker transcode, dashboard panels; stable public ids) |
| **M30** Release ops toolkit | 🟡 Partial | Release ops panel: catalog, credits, checklist, society pointers, JSON export, **MusicBrainz step-by-step guide**; UPC/ISRC on `/r/:slug`. Deferred: Discogs API |
| **M29** Backup & DR | 🟡 Partial | Unified **`scripts/backup.sh`** (postgres, minio, restore-test, status); **`ops/RUNBOOK.md`**, `install-crons.sh`. Deferred: pgBackRest, offsite buckets, operator drills |
| **M20** Tier gating | 🟡 Partial | Weekly cap + **60s grace**, reconnect during grace, orchestrator **/stop** on cap enforcement, dashboard warnings + **`warningLevel`** API (`45m`/`55m`/`grace`/`blocked`) + **upgrade CTA**, HLS tier split, archive FLAC for paid artists (broadcast archive worker). Deferred: further copy polish |

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
| [~] | Wire `@tahti/ui` into `apps/web` (tokens + components exist, web still uses inline CSS) | `/c`, `/u`, `/r` brand layouts; **`/dashboard` studio shell** (`brand-studio.css`) | M12 / DX |
| [x] | `@tahti/ui`: add `lint` script to Turbo pipeline | `packages/ui` ESLint via `turbo lint` | CI |
| [x] | Consolidate e2e seed scripts (`scripts/seed-e2e-screenshots.ts` vs `apps/api/scripts/`) | Root script re-exports `apps/api/scripts/seed-e2e-screenshots.ts` | CI / DX |
| [x] | Stripe webhook: return **500** on handler failure (Stripe retries; audit log retained) | Silent membership/fan-sub activation failures | M19 hardening |
| [~] | Automate `db push` / migrate in deploy pipeline (OPS-002) | `db-push` service in `stack-up.sh`; production website-only deploy still manual | M0 / Phase 2 |
| [x] | Document local test prerequisites in README (`docker compose up postgres redis -d`, `pnpm ci:check`) | Onboarding friction; tests fail opaque without DB | M11 |
| [~] | **Postgres backup pipeline** — pgBackRest (or `pg_dump` interim) → MinIO `backups/pg/` → UpCloud offsite; daily cron + age alert | Artist uploads, ledger, memberships are irreplaceable; RPO 1h per `infra-strategy.md` | M29 / Phase 2b |
| [~] | **MinIO mirror** — `mc mirror` tahti → UpCloud bucket daily; verify object count | `scripts/backup.sh minio` compares primary vs DR counts (1% tolerance) | M29 / Phase 2b |
| [x] | **Restore-test automation** — weekly script restores latest PG dump to throwaway DB, row-count check, log to `/var/log/tahti-restore-test.log` | Backups that are never restored are fiction; required before public beta | M29 / Phase 2b |
| [~] | **`ops/RUNBOOK.md` restore procedures** — Postgres point-in-time, MinIO bucket swap, DR read-only origin on UpCloud | Operators must recover without the director on call | M11 handover |
| [x] | Engagement-unit data pipeline (downloads + fan-sub euros) feeding grant calc | Both inputs now live: download weight (M18) + fan-sub gross euros (M19) feed `computeEngagementUnits` | M18 + M19 → M9 (done) |

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
| [ ] | Secrets management (Docker secrets / sops) documented | Dev | stack up | — |
| [ ] | Staging environment mirrors production topology | Dev | M0 | — |
| [ ] | Monitoring + alerting (uptime, disk, Liquidsoap health) | Dev | stack up | — |
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
| [x] | Monitoring alert: **backup age > 26h** → WARN; **> 48h** → page on-call | Dev | `backup.sh status` in cron | `technical/journey-ops.md` |
| [ ] | pgBackRest (replace interim `pg_dump` when hardware stable) + WAL shipping | Dev | Postgres prod | `future-improvements.md` |
| [ ] | Pre-destructive-op snapshot: `docker run … pg_dump` before migrations / volume resize | Dev | — | `technical/phase-7.md` |
| [~] | `ops/RUNBOOK.md` — restore Postgres, restore MinIO prefix, DR read-only cutover | Dev | restore test passed once | Phase 9 |
| [ ] | Operator drill: restore from yesterday's backup without director (timed exercise) | Operators | RUNBOOK | Phase 9 §8b |
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
| [~] | **M20** (partial) | Free tier: 1 hr/week live cap + MP3 HLS; paid: FLAC HLS + unlimited live | Dev |

**MVP test matrix (must pass before inviting beta artists):**

| Done | Test | Method |
|:---:|---|---|
| [ ] | Register → verify email → pay €40 → appear in member export | manual + automated |
| [ ] | OBS guide: copy-paste RTMP → LIVE within 5s | `obs-and-broadcasting-guides.md` |
| [ ] | Mixxx / Icecast path works | manual |
| [ ] | Stop broadcast → archive within 10s, no silence | manual |
| [ ] | Chat: anonymous join, 24h expiry, artist ban | manual |
| [ ] | Free user hits weekly hour cap gracefully | M20 |
| [ ] | Paid channel streams FLAC; free channel MP3 | M20 |
| [ ] | Load test: N concurrent listeners on one channel | script |

**Exit criteria:** 5 internal dogfood channels running 48h without intervention.

---

## Phase 4 — Implementation: money, transparency, grants

Required before first **real** membership money and first grant cycle.

| Done | Milestone | Summary | Owner |
|:---:|---|---|---|
| [x] | **M8** | Public transparency ledger + monthly rollup API + grants/:year report | Dev |
| [~] | **M7** | Mixcloud OAuth + upload; Revelator submit from release ops (€8/release billing deferred) | Dev |
| [ ] | **M30** | **Release ops toolkit** — MusicBrainz submission, ISRC/UPC/credits, release checklist (official metadata out of the way) | Dev |
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
| [~] | **M12** | Profile + releases + smart links + MinIO cover art | High |
| [~] | **M30** | Release ops toolkit (MusicBrainz, catalog metadata, release checklist) | Medium |
| [~] | **M20** | Tier gating polish, upgrade UX | High |
| [~] | **M18** | Anonymous + fan downloads, anti-fraud (Tor/fraud cron remain) | High |
| [~] | **M14** | Embed pages done; social auto-post + analytics remain | Medium |
| [~] | **M13** | Newsletter API + worker; SES + bounce webhook remain | Medium |
| [x] | **M6** | Multistream RTMP targets | Medium |
| [x] | **M16** | Tahti Radio meta-stream | Medium |
| [x] | **M15** | Artist @-mentions | Low |
| [~] | **M17** | Venue API + iCal + board verification UI | Low |
| [~] | **M11** | Rate limits, hCaptcha, audit export, OpenAPI; Upptime + backup/DR drills remain | High before Y2 audit |

**Exit criteria:** profile URL shareable; downloads + fan-subs used by ≥10 beta artists.

---

## Phase 6 — hearthis parity (catalog UX)

See `competitive-gaps-hearthis.md` for full gap list.

| Done | Milestone | Summary |
|:---:|---|---|
| [~] | **M22** | Per-item metadata + editable tracklists with **@artist tagging** (dashboard tracklist editor wired) |
| [~] | **M23** | Collections (albums, mix series) + RSS; featured collections on profile and `/r/:slug` smart links |
| [~] | **M28** | **Track version history** — archive + release-track versions; activate; stable public ids |
| [~] | **M24** | Channel gallery/text layers + **channel video backdrop**; per-item banner/slideshow; YouTube/Vimeo on archive items |
| [x] | **M25** | Artist commentary on archive items (dashboard + public channel page); optional listener comments deferred |
| [~] | **M26** | Channel **video/image backdrop** + gallery/text-layer theme picker in dashboard; per-collection visual themes deferred |
| [~] | **M27** | **Programme API** + dashboard rotation editor; `fallback.m3u` respects `isFallback`, ordered/fair shuffle; live auto-archive joins rotation. Deferred: moderator roles, ACRCloud annotation cron, per-set visualisations |

## Phase 6b — Release ops & catalog metadata (**M30**)

Artists need more than a smart link and a Revelator upload: the **official** side of a release — open-catalog entries, identifiers, credits, and society paperwork — is fragmented across a dozen sites. **M30** bundles guided tooling so Tahti handles the boring part and the artist ships once.

**Principle:** one release record in Tahti → reusable metadata for every downstream system. No duplicate data entry.

| Done | Capability | Notes |
|:---:|---|---|
| [~] | **MusicBrainz submission** | MBID fields + submit link + **in-panel guide** + MusicBrainz URL on smart link |
| [~] | **ISRC + UPC/EAN** | Release ops capture; display on `/r/:slug` |
| [~] | **Credits & roles** | Dashboard credits editor; JSON export |
| [~] | **Copyright lines** | P/C-line + label imprint |
| [~] | **Release checklist wizard** | Steps in release ops panel |
| [~] | **Post-release claim links** | Spotify for Artists, Apple, YouTube OAC |
| [~] | **Export pack** | Download JSON |
| [~] | **Collecting-society pointers** | Teosto, PRS, GEMA, etc. |

**Deferred (later M30+):** Discogs submission API, direct PRO registration, AllMusic pitch workflow.

**Depends:** M12 release schema (partial ✅), M7 Revelator wizard (partial). **Doc:** `AGENT.md` §M30.

---

Spec in `audio-editor.md` (**M21**) — see **§M21 implementation options** for phased plan (v0 trim → v1 multitrack → v2 LUFS/limiter).

| Done | Task | Owner | Doc |
|:---:|---|---|---|
| [ ] | **v0** Single-file trim/fade + save to archive | Dev | `audio-editor.md` §Phased delivery |
| [ ] | **v1** Multitrack timeline (`@waveform-playlist/browser`) | Dev | `audio-editor.md` |
| [ ] | **v2** Master LUFS + limiter on bounce | Dev | `audio-editor.md` |
| [ ] | Bounce worker → archive / release pipeline | Dev | `AGENT.md` |
| [ ] | Editor load test (large WAV, 1h DJ mix) | Dev | — |

---

## Phase 8 — Closed beta → open beta (200 artists)

Aligned with `strategy-and-product.md` acquisition plan.

| Done | Task | Owner | When |
|:---:|---|---|---|
| [ ] | Recruit **10 anchor artists** (director network, invite-only) | Director | Month 1–3 |
| [ ] | Beta feedback form + issue triage process | Dev | Month 2 |
| [ ] | Weekly beta office hours (Discord/video) | Director | Month 2–6 |
| [ ] | Fix P0 bugs within 48h SLA | Dev | ongoing |
| [ ] | Publish OBS / Mixxx / Traktor guides on dashboard | Dev | M3 done |
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
| [ ] | `ops/RUNBOOK.md` — deploy, rollback, **Postgres + MinIO restore**, DR cutover | Dev |
| [ ] | `ops/BACKUP.md` — RPO/RTO table, cron schedule, offsite bucket names, escalation | Dev |
| [ ] | `ops/INCIDENTS.md` — outage comms, escalation | Dev |
| [ ] | `ops/ONBOARDING-OPERATOR.md` — training syllabus | Director |
| [ ] | `ops/TREASURER.md` — ledger import, grant payout, PRH export | Treasurer |
| [ ] | `ops/AGM-PLAYBOOK.md` — motions, voting, minutes template | Board |
| [ ] | Architecture diagram (hardware, Swarm, data flows) | Dev |
| [ ] | Credential inventory (who has access to what) | Director |
| [ ] | Vendor contact list (fiber, UpCloud, Stripe, Revelator) | Director |

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
| [ ] | **PLAT-003** | PgBouncer before scaling API replicas (`docs/scaling-node-distribution.md`) | P1 |
| [x] | **PLAT-004** | Internal ingest routes: shared `@fastify/formbody` + integration tests for RTMP + Icecast | `ingest.test.ts` |
| [~] | **PLAT-005** | Swagger `/docs` credentials via Docker secrets, not env defaults | `DOCS_*_FILE` on API in `docker-stack.yml`; `readSecret` + prod warning | P2 |
| [x] | **PLAT-006** | Rate-limit policy doc: fail-open vs fail-closed when Redis unavailable | P2 |

### Optimisations (performance & cost)

| Done | ID | Item | Priority |
|:---:|---|---|---|
| [~] | **PLAT-010** | Turbo remote cache in CI | `remoteCache` in `turbo.json`; `TURBO_TOKEN` + `TURBO_TEAM` on lint/typecheck — see `.github/TURBO_REMOTE_CACHE.md` |
| [x] | **PLAT-011** | Redis client singleton (status, rate-limit, sessions share one pool) | `apps/api/src/lib/redis.ts` | P2 |
| [~] | **PLAT-012** | Vitest parallel workers + Testcontainers (replace `maxWorkers: 1` + memberNumber bands) | `allocateMemberNumber()` test helper (dynamic member #); Testcontainers deferred | P2 |
| [x] | **PLAT-013** | Website Docker: mount large media (`bg-audio.mp3`, hero video) from host like `output_vhs.mp4` | `.dockerignore`, stack + local compose binds | P3 |
| [~] | **PLAT-014** | OpenAPI response schemas generated from Zod (keep `/docs` in sync with routes) | + `openApiResponse` on gate stats, egress, live stats, broadcast-usage, schedule; venue/collection tags |

### Refactors (maintainability)

| Done | ID | Item | Priority |
|:---:|---|---|---|
| [~] | **PLAT-020** | Adopt `@tahti/ui` in `apps/web` dashboard + public pages | Studio shell + public brand on login/join/transparency/channel/profile/governance/subscribe/embed/smart link |
| [~] | **PLAT-021** | Zod on all route bodies (governance, ledger, fansubs, releases partially ad-hoc) | + path params; query Zod on collections, venues, mixcloud, track download, archive paths |
| [x] | **PLAT-022** | Single e2e seed module exported from `@tahti/db` test helpers or `apps/api/scripts/` only | P2 |
| [x] | **PLAT-023** | Centralise worker cron registration (`apps/worker/src/index.ts` → job manifest) | P2 |
| [x] | **PLAT-024** | Shared `exportCsv(reply, rows)` for admin exports | `sendCsv()` — members, audit, fan-subscriber exports |
| [x] | **PLAT-025** | Remove `eslint.ignoreDuringBuilds` in web Dockerfile once lint clean in CI | `next.config.mjs` — lint enforced at `next build` | P3 |
| [x] | **PLAT-026** | Reconcile tier enum in AGENT.md (`FREE/PAID` vs `FREE/ARTIST/STUDIO`) | P2 |

---

## Streaming infrastructure backlog

Issues identified from streaming architecture review and user journey analysis. See `docs/technical/streaming-architecture.md` for full context.

### CRITICAL — blocks horizontal scaling

| ID | Issue | Raised by | Phase to fix |
|:---|---|---|---|
| [~] | **STREAM-001** HLS segments written to shared Docker volume instead of MinIO — prevents adding a second Caddy or worker node | `hls-minio-sync` worker cron mirrors volume → `hls-live` bucket; stack `tahti_stack_hls` volume | M3 |
| [ ] | **STREAM-004** Recording is a Liquidsoap sidecar — recording lost if Liquidsoap crashes mid-broadcast | Architecture review | M3 |
| [~] | **STREAM-005** No per-channel health watchdog — silent/frozen channels go undetected until user reports | `channel-watchdog` worker cron + orchestrator `/restart` when segments stale | M3 |

### HIGH — breaks artist or listener experience

| ID | Issue | Raised by | Phase to fix |
|:---|---|---|---|
| [ ] | **STREAM-002** No edge encoder tier — Liquidsoap receives raw RTMP/Icecast directly, preventing quality normalization and independent restart recovery | Architecture review | M3 |
| [ ] | **STREAM-003** Ingest DNS failover has 30s dead window — OBS connections to failed ingest node must manually reconnect | Architecture review | M3 / Phase 4 |
| [~] | **ARTIST-001** OBS disconnect during broadcast does not produce partial recording — total loss if disconnect before graceful end | `finalize-broadcast-recording` on RTMP/Icecast disconnect → MinIO → `archive-broadcast`; stack `tahti_stack_recordings` volume | M4 |
| [~] | **ARTIST-002** Stream key rotation requires going offline — no hot-rotation while live | API returns 409 while `LIVE` (RTMP + Icecast rotate); hot rotation deferred | M3 |
| [~] | **ARTIST-003** Liquidsoap archive fallback has no warm-up period — first listener after offline transition may get buffer-empty | `delay(3.)` on archive branch before live fallback | M3 |
| [~] | **LISTENER-001** Mobile listener on slow 4G: HLS segment interval (3s) with 6–9s buffer means 10–15s initial load — needs explicit buffering indicator | Live player shows “Buffering live stream…” (LISTENER-001) | M3 |
| [x] | **LISTENER-002** No "artist coming back soon" signal — listener who tunes in during offline period has no indication when next broadcast is | API + dashboard schedule panel + public `/c/:slug` banner | M5 |

### MEDIUM — affects operations and cost attribution

| ID | Issue | Raised by | Phase to fix |
|:---|---|---|---|
| [~] | **STREAM-006** No per-channel bandwidth accounting — can't attribute egress costs per artist, can't inform resource limits or grant calculations | `GET /api/me/channel-egress` + dashboard 30d chart (download bytes; HLS egress deferred) | M8 |
| [ ] | **STREAM-007** Single Icecast node — Mixxx/Traktor users have no failover | Architecture review | Phase 5 / pre-launch |
| [ ] | **STREAM-008** chromaprint fingerprint runs post-broadcast only — real-time tracklist UX requires at-ingest fingerprinting | Architecture review | M4 |
| [ ] | **STREAM-009** Liquidsoap archive fallback reads MinIO cold on each segment — no local cache means repeated round-trips to MinIO for popular archive items | Architecture review | M3 |
| [x] | **OPS-001** No structured log correlation across edge encoder → Liquidsoap → recording containers for a single broadcast session | `broadcastSessionId` on ingest, orchestrator, watchdog, finalize, archive jobs | M11 |
| [~] | **OPS-002** DB migration is a manual step after deploy — must be automated in CI before service update | `scripts/db-migrate-deploy.sh`, `ops/DEPLOY.md`, `make deploy`; CI `prisma migrate status` after test DB push | M0 |

### LOW — improvements for polish

| ID | Issue | Raised by | Phase to fix |
|:---|---|---|---|
| [ ] | **STREAM-010** Graceful drain on Liquidsoap stop may emit an incomplete final HLS segment — listeners hear a cut instead of a fade | Architecture review | M3 |
| [~] | **ARTIST-004** Upload progress bar shows browser→MinIO upload only, not transcode progress — artist thinks "nothing is happening" during transcode | Dashboard polls archive status after upload with transcoding progress (ARTIST-004) | M2 |
| [~] | **LISTENER-003** Anonymous listener sets a handle in localStorage but it resets if cookies cleared — confusing return identity | `tahti_chat_handle` cookie + localStorage fallback on join | M5 |
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
| Backup & restore flow? | `technical/phase-3.md`, [Phase 2b](#phase-2b--backup--disaster-recovery-before-public-beta) |
| Ops journeys (restore drill)? | `technical/journey-ops.md` |

---

## Issue labels (for GitHub Projects)

- `legal` · `grant` · `infra` · `backup` · `milestone/M*` · `test` · `beta` · `handover` · `ops`

Create one issue per milestone sub-task or per checkbox row as you begin execution.
