# Todo history

Completed work lands here — **append, never overwrite**. Active work stays in `docs/todo/*.md`
(except this file). See `CLAUDE.md` and `.cursor/rules/todo-history.mdc`.

Each entry is a compact dated section (original filename + what shipped). Do not paste full
session transcripts. Leftover open items go to `docs/remaining-work.md` or a new todo file.

## 2026-09-04 — export-provider-contracts.md

Branch: `feat/export-provider-contracts` (checkout: `tahti-export-api`).

### Goal

Expose versioned ExportProvider submit/status/webhook contracts so Nuclear can
move past metadata/deep-link export targets.

### Plan

1. Shared Zod DTO + list registry (Revelator real paths).
2. `GET /api/me/export-plugins` + thin submit/status aliases + webhook stub.
3. Credential lifecycle doc pointing at `/api/me/integrations`.
4. Tests + commit.

### Status

Shipped — see worklog `docs/worklogs/2026-09-04-export-plugin-contracts.md`.

## 2026-09-04 — listenbrainz-scrobble.md

Branch: `feat/listenbrainz-scrobble`.

### Goal

Submit-listens scrobbling via existing integrations credential store (not charts).

### Plan

1. Registry: `SCROBBLE` scope + `listenbrainz` provider; DTO + dashboard section.
2. `apps/api/src/lib/listenbrainz.ts` — validate-token + submit-listens.
3. Installer validates token before storing `{ userToken }`.
4. Fire-and-forget scrobble after successful listen-event create for session users.
5. Docs + unit/route tests; commit on branch.

### Status

Shipped — see worklog `docs/worklogs/2026-09-04-listenbrainz-scrobble.md`.

## 2026-09-05 — channel-designer-studio-rework.md

# Studio Channel Designer — uploads + section dropdown + help

## Goal

Rework `/dashboard/channel/edit` (core Studio) so it is usable:

1. Section **dropdown** (background, header/backdrop, player, tracks, collections, releases, …) instead of a tall vertical nav of instructional chrome.
2. **In-editor uploads** via `FileDropzone` — multi-image gallery DnD; video files auto-set header style to `VIDEO_LOOP`.
3. **Always-available page/background color pickers** (not buried behind visualizer ≠ MINIMAL / brand swatches only).
4. Move instructional copy into a collapsible **help** layer; forms stay compact.

## Status

Implemented on `feat/channel-designer-uploads-help` (2026-09-04).

## Verify

1. Open `/dashboard/channel/edit` — section dropdown at top of panel; no left vertical section list in the editor grid.
2. Background: change Background color — live preview wash updates (not stuck purple).
3. Header / backdrop: drop multiple JPGs into gallery dropzone; drop MP4 → header style becomes video loop.
4. Help (?) expands section instructions; forms have no long annotation paragraphs.


## 2026-09-05 — channel-look-extras.md

# Channel look-extras persistence

Merged: [tahti-org#435](https://github.com/janiluuk/tahti-org/pull/435) → `main`.

## Goal

Persist Channel Designer look extras that Nuclear previously kept only in
`localStorage` (`tahti.channelLookExtras.{slug}`) on the Channel model so
owner GET/PATCH and public channel/profile responses round-trip them.

## Status

Shipped on `main` (2026-09-04). Deploy prod next so migration
`20260904030000_channel_look_extras` runs. Nuclear client already sends
look extras on PATCH (`0.0.71`). Keep localStorage as cache until all envs
have the migration.

## 2026-09-05 — addons-rename-and-branding-widgets.md (shipped parts)

- DiscoWidget → Addon rename (tables, DTOs, routes, SDK, docs) + `enabledByDefault`.
- Bio clamp via `ExpandableText` on channel/profile pages.
- Open remainder: `docs/todo/channel-designer-blocks.md`.

## 2026-09-05 — listen-news-widget.md

Artist RSS/Atom `newsFeedUrl` → dashboard News feed panel + public `GET /api/v1/u/:username/news` on the channel page. PR [#432](https://github.com/janiluuk/tahti-org/pull/432).

## 2026-09-05 — track-detail-purchase-gate.md

`GET /api/tracks/:id` withholds `audioUrl` when gated; purchase-tier fields + download gate. PR [#434](https://github.com/janiluuk/tahti-org/pull/434).

## 2026-09-05 — lastfm-user-api-key-modal.md

Studio Last.fm Connect modal (user API key + secret → `POST …/lastfm/prepare` → OAuth). PR [#439](https://github.com/janiluuk/tahti-org/pull/439).

## 2026-09-05 — remaining-work done rows

Removed from `docs/remaining-work.md` (they were still listed as current work):

- STREAM-011 A (on-demand FLAC)
- Playwright smoke in CI (nightly)
- PLAT-082 Google Drive import audit-log
- Governance: advisory motions, public history API, meeting metadata/attendance/quorum

## 2026-09-05 — archived session worklogs

Compact shipped summaries. Leftovers live in `docs/remaining-work.md` § Session leftovers.

### 2026-08-17 — ci-pipeline-radio-storage-auth-fixes.md

CI prettier/SDK tug-of-war, Bearer token prefix, radio status from `RadioSlotBooking`, channel watchdog, member storage panel vs policy, forgot-password / resend-verification.

### 2026-08-25 — recurring-shows-account-restrictions-and-site-refresh.md

Live-show recurrence + missed-show queue + `AccountRestriction`; About/README screenshots; marketing slide deck; Grafana logs; channel compactness; hearthis mini-player; `app.tahti.live` NPM redirect fix.

### 2026-08-28 — refactor-sweep-beta-cta.md

Homepage/about beta CTA, `/join`→`/signup`, docs routing, `BetaApplyForm` when signup closed, prod seed guard, `resolveServerApiUrl`. Leftovers: R10–R14.

### 2026-08-29 — artist-admin-ux-audit.md

UX-01–04, UX-06–07, channel designer links/text overlay shipped. UX-05 partial (`FileDropzone` not yet on identity/album/multitrack).

### 2026-08-30 — admin-storage-usage-fix.md

Admin storage uses live `computeAllUsersStorageUsedBytes` + `softTargetBytes`; `revisionCount` on admin files.

### 2026-08-31 — discover-feed-cards.md

Discover “Your feed” cards, import-plugin contract start, Go Live polish, nav grouping, API cache coalescing. STREAM-011 B spike notes kept in remaining-work.

### 2026-09-01 — deploy-production-auto-deploy-fix.md

`deploy-production.yml` now runs `scripts/deploy_prod.sh`; removed dangerous lab-stack deploy path.

### 2026-09-01 — docs-staleness-audit.md

CDN doc superseded banner; worker-crons table corrected. Streaming-architecture vs live infra still unverified.

### 2026-09-01 — governance-route-map-update.md

Corrected actual admin governance routes (retracted a migration that never shipped). Orphan `/dashboard/channel/text` → redirect. Route 404 leftovers in remaining-work.

### 2026-09-01 — tahti-jam-and-mcp-endpoint.md

`/api/v1/mcp` search tool + Tahti Jam sessions/SSE. Multi-instance SSE still in-process.

### 2026-09-01 — responsive-usability-audit.md

Audit only; implementation list kept as `docs/todo/responsive-usability-audit.md`.

### 2026-09-03 — discord-bot-admin-settings.md

Encrypted `DiscordBotSettings` + admin PUT + internal credentials. Bot playback still local `tracks.txt`.

### 2026-09-03 — import-plugin-capability-contracts.md

`GET /api/me/import-plugins` live catalog. Export contracts later shipped separately (see 2026-09-04).

### 2026-09-04 — channel-look-extras.md / export-plugin-contracts.md / listenbrainz-scrobble.md

Look extras persistence; ExportProvider registry + Revelator aliases; ListenBrainz scrobble. Export webhook sync leftover in remaining-work.

### 2026-09-05 — lastfm-scrobble.md / stats-plays-hourly.md

Last.fm scrobble beside ListenBrainz. Artist plays `range=1` / custom / hourly buckets. PRs [#437](https://github.com/janiluuk/tahti-org/pull/437), [#438](https://github.com/janiluuk/tahti-org/pull/438).

### 2026-09-05 — governance-worklog delivered slice

Advisory motions, discussion, public history, meeting/document schema, attendance/quorum, governance journey tests, yearly transparency reports. Open items remain in `docs/governance-worklog.md`.

