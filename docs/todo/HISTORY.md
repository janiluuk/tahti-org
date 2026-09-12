# Todo history

Completed work lands here — **append, never overwrite**. Active work stays in `docs/todo/*.md`
(except this file). See `CLAUDE.md` and `.cursor/rules/todo-history.mdc`.

Each entry is a compact dated section (original filename + what shipped). Do not paste full
session transcripts. Leftover open items go to `docs/remaining-work.md` or a new todo file.

## 2026-09-11 — admin-mail-stats-dashboard.md

Folded the contact-inbox metrics task after its Prometheus exporter, board-only
API endpoint, dashboard KPI tile, Grafana row, deployment wiring, and tests
landed.

## 2026-09-11 — squash-db-migrations.md

Folded the migration squash after the single baseline migration was verified
against throwaway Postgres and the deploy path was checked for compatibility.
No production migration action is required because the stack uses `prisma db push`.

## 2026-09-11 — plugin registry contract tests

Synchronized the Tahti checklist with the additive adapter and host contract
test suites already shipped in `../tahti-player`. Caller migration and the
ownership split remain intentionally open under the non-breaking guardrail.

The shipped contract-test row was removed from `docs/remaining-work.md` so the
open-work index contains only incomplete items.

Core player callers were then migrated to `pluginRegistryStore` in player PR
#46; the Tahti-side checklist now records that milestone as complete.

## 2026-09-08 — stale-todo sweep: 3 already-merged files never folded

Building `docs/todo/INDEX.md` surfaced three todo files whose branches
had already merged to `main` weeks ago but were never folded per this
file's own rule — folding them now instead of indexing stale entries:

- **stream-overlay-scrim-toggle.md** (PR merged via `d0478fb8`,
  2026-09-07): `Channel.streamOverlayScrimEnabled` + RTMP mirror scrim
  rectangle behind baked title/subtitle text. tahti-player frontend
  toggle confirmed wired (`StreamOverlayEditor.tsx`).
- **stream-overlay-show-title-toggle.md** (PR #441 merged, 2026-09-05):
  `Channel.streamOverlayShowTitle` — RTMP mirror renders no title/subtitle
  text at all unless the artist opts in (previously always rendered,
  falling back to display name). tahti-player frontend toggle confirmed
  wired.
- **recurrence-duration-overlap.md** (PR #476 merged): `ScheduledLiveShow.endAt`
  now set from `LiveShowSeries.recurrenceDurationMin` (falling back to
  `intervalHours`); overlapping generated/manual episodes rejected
  (409). Doc's own "Leftovers" note (public channel schedule cards
  still start-only) not re-verified — check before assuming still open.

## 2026-09-08 — pwyw-track-purchase-frontend.md

Doc said backend-only, frontend still to do in `../tahti-player`. Checked
`tahti-player/packages/tahti-web/src/views/TrackDetailView.tsx`: `buyTrack()`
already branches on `detail?.purchaseTierPriceOptional` and shows an amount
input; `api/types.ts` has the field on its track-detail type; `api/client.ts`'s
mock populates it from `tier?.priceOptional`. The doc's own "Not done here"
checklist is fully done — folding as shipped on both sides.

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

### 2026-09-06 — channel-designer-blocks.md / stream-manager-artist-page.md / governance-meeting-officers.md

Shipped on main: Channel Designer logo/addon blocks ([#445](https://github.com/janiluuk/tahti-org/pull/445)); stream manager on Studio overview ([#449](https://github.com/janiluuk/tahti-org/pull/449)); meeting officers ([#447](https://github.com/janiluuk/tahti-org/pull/447)).

### 2026-09-06 — restore-download-purchase-gate.md

Download gate restored (`ca7ee137`). Public list/play paths now use `resolvePlaybackGateStatus` before presigning: channel items, discover latest-tracks, Selects gallery, new-to-you, followed feed, collection pages, embed play, and smart-link tracks linked to a gated Sound. Channel-item cache no longer stores URLs. RSS omits `<enclosure>` for non-FREE sounds. Album `ReleaseTrack` files with no linked Sound have no purchase-tier field and stay streamable on the smart link.

### 2026-09-08 — sounds-player-artwork-overlay.md

Dashboard Sounds player: title/artist restored as a legible overlay on the waveform (was getting squeezed out of the icon row entirely), controls row stays one line, embed rows (Mixcloud/Spotify/Hearthis) no longer double up the provider label, row background now tints from the track's own artwork, and cover art renders as a consistent 1:1 square. Also fixed the Mixcloud/Spotify embed branch missing its `data-tahti-ui="brand"` wrapper (styles weren't applying at all) and added the missing Love/Download/Repost/Comments icons to embed-only rows. PR [#469](https://github.com/janiluuk/tahti-org/pull/469). Not verified against a live seeded app — see `docs/remaining-work.md`.

### 2026-09-06 — member-badge-profiles.md

Tahti ry `MemberBadge` on public profile + channel identity; join-date copy renamed to “Joined …”. PR [#456](https://github.com/janiluuk/tahti-org/pull/456).

### 2026-09-08 — channel-mobile-chat-and-live-player-ux.md

Channel page mobile/desktop chat and live-player polish, shipped on `feat/channel-mobile-chat-live-player-ux`: mobile chat hidden by default, fullscreen sheet on tap; desktop right-edge chat rail that collapses to a dock expand control; header/player shows REPLAY vs LIVE from Icecast `signalConnected`; live player title from `nowPlaying` metadata; corner "Profile »" link removed. PR [#472](https://github.com/janiluuk/tahti-org/pull/472).

### 2026-09-08 — responsive-usability-audit.md

All ten MOB-01–MOB-10 implementation items shipped: mobile-first `/listen` and `/radio` chrome plus shared `--fixed-stack-bottom` safe-area/mini-player/studio-nav contract ([#446](https://github.com/janiluuk/tahti-org/pull/446)); settings `MobileNavSheet` and admin logs Filter sheet ([#451](https://github.com/janiluuk/tahti-org/pull/451)); home single primary CTA + capped previews, idle auto-scroll removed, admin tables as stacked cards with `admin-table-wrap--tabular` opt-out for audit/ledger data (this repo's earlier session); Discover `ChipFilterBar` sheets and progressive-disclosure `StudioCollapse` forms ([#453](https://github.com/janiluuk/tahti-org/pull/453)). Audit notes stay in this file's 2026-09-01 entry above.

### 2026-09-08 — pwyw-track-purchase-frontend.md (stale — already done)

This repo's backend piece (`GET /api/tracks/:id` returning
`purchaseTier.priceOptional`, commit `032c804d`) shipped and merged to
`main` on 2026-09-07 as documented. Re-checked the sibling `tahti-player`
repo before picking up the "not done here" frontend leftover the doc
described, and it was already built: `TrackDetailView.tsx`'s buy button
checks `purchaseTierPriceOptional` and opens a PWYW amount dialog
(`pwywOpen`/`pwywAmt`) instead of always sending the suggested price,
`api/types.ts` and the mock `client.ts` carry the field, and
`PurchaseTiersEditor.tsx` already exposes the "pay what you want" toggle
artists use to create such a tier — folded there as part of
`tahti-player`'s own 2026-09-07 "Purchase-tier artist editor built"
HISTORY entry. No code changed in this repo; removing the stale todo file.

### 2026-09-08 — stream-overlay-scrim-toggle.md / stream-overlay-show-title-toggle.md (stale — already done)

Backend pieces (`Channel.streamOverlayScrimEnabled` and
`streamOverlayShowTitle`, `buildRtmpMirrorOutput` support) shipped
2026-09-05/07 as documented. Re-checked the sibling `tahti-player` repo
before picking up either doc's "not done here" frontend leftover, and
both toggles are already wired end-to-end: `StreamOverlayEditor.tsx`
renders both toggles, gates the title/subtitle inputs and the scrim on
`OverlayTextPreview`, and `api/broadcast.ts`'s `StreamOverlay` type/mock
fallback carry both fields — folded there as `tahti-player`'s own
2026-09-05 "cover upload UX fix + show title toggle + preview" and
2026-09-07 "Stream overlay scrim toggle: frontend piece" HISTORY entries.
No code changed in this repo; removing both stale todo files.

### 2026-09-08 — recurrence-duration-overlap.md

`ScheduledLiveShow.endAt` (nullable) now set from
`LiveShowSeries.recurrenceDurationMin` (fallback `intervalHours`);
generated recurrence occurrences that would overlap an existing channel
show are filtered out, manual schedule returns 409 on conflict, and the
studio schedule list surfaces the end time when known. PR
[#476](https://github.com/janiluuk/tahti-org/pull/476), merged. Public
channel schedule cards still show start-only — noted in
`docs/remaining-work.md`.

### 2026-09-08 — vimage6-monitoring-gauges-and-api-scrape-auth.md

Last open item was the bearer-token file for the `tahti_api_metrics`
Prometheus scrape — written to `prometheus.yml` but blocked on
`/opt/monitoring/prometheus/config/tahti-api-metrics.token` existing on
vimage6 (needs `INTERNAL_SECRET`, which this session can't read
unsupervised). SSH'd to `vimage6.local` (session had no route to the
plain `vimage6` hostname, but `.local` resolves) to check without
touching secrets: the token file exists (`tahti-api-metrics.token`,
written 2026-09-08 03:53, presumably via `deploy.sh`), `prometheus.yml`
has `bearer_token_file: /etc/prometheus/tahti-api-metrics.token` on the
`tahti_api_metrics` job, and Prometheus's own `/api/v1/query?query=up`
confirms `up{job="tahti_api_metrics"} == 1` — scrape is live and
healthy. Also confirmed every other job (`cadvisor`/`node`/
`docker-catalog` across all 10 hosts incl. vimage7) reports `up == 1`,
so the whole dashboard's data is now clean. No code or config touched
this session — read-only verification only.

### 2026-09-08 — governance-audit-log.md

All ten topics on `/admin/governance/audit` shipped across three slices:
notice publication (`MEETING_NOTICE_PUBLISH`) plus real per-recipient
delivery evidence (`GovernanceNoticeDelivery`, sent via
`sendGovernanceMeetingNoticeEmail`, bounce-marked by the existing
email-bounce webhook, `MEETING_NOTICE_SEND` audited, surfaced at
`GET /api/admin/governance/meetings/:id/notice-deliveries` and in
`governance-records-panel.tsx`'s expanded meeting row); minutes upload/
approve/sign/redact/publish as five distinct audited steps
(`minutesRedacted`, `minutesPublishedAt`); `BoardResolution` optionally
linked to a `GovernanceMeeting` (`meetingId`, cross-schema `admin`→
`governance`) with a `binding` flag, wired into `resolutions/page.tsx`'s
create form and table; and a new `conflicts` topic
(`GovernanceConflictDeclaration`, `CONFLICT_DECLARE`) replacing what had
been a "no data model yet" placeholder. Migrations
`20260908090000_governance_notice_delivery_minutes_publish_resolution_link`
and `20260908100000_governance_conflict_declarations`, both hand-verified
against a scratch `postgres:16-alpine` container (`prisma migrate dev`'s
shadow-db validation is blocked by a pre-existing, unrelated
migration-history bug — an early migration references the `channel`
schema before any migration creates it). Backend slice 2: PR
[#484](https://github.com/janiluuk/tahti-org/pull/484); frontend +
conflict-declarations slice 3 landed in the same commit as this fold.
Remaining known gap: notice open-tracking — no tracking-pixel infra
exists anywhere in this codebase, deliberately out of scope.

### 2026-09-08 — release-artwork-delete.md

`DELETE /api/me/releases/:id/artwork` plus the frontend wiring
(`CoverImageUpload`'s Remove button previously discarded its `null`
argument and just refreshed, so removing artwork never actually
persisted). PR [#480](https://github.com/janiluuk/tahti-org/pull/480),
merged. Todo file left un-folded after merge — folding now.

### 2026-09-08 — admin addons metadata edit + delete routes

`../tahti-player`'s admin Add-ons panel called `PATCH`/`DELETE
/api/admin/addons/:id` for metadata editing and deleting a widget, but
neither route existed server-side — only ever worked in that frontend's
mock mode (discovered while wiring the `enabled-by-default`/
`default-config` actions on the player side, a separate change). Added
both: `PatchAddonSchema` (`packages/shared/src/dto/addons.ts`, full
metadata replace — name/description/authorName/categories/iconUrl; slug
and scope stay immutable after registration) and the two Fastify routes
in `apps/api/src/routes/admin/addons.ts`, matching the file's existing
board-only/`ADMIN_ITEM_SELECT` conventions. `DELETE` relies on the
`Addon.versions`/`Addon.installs` cascade FKs already in `schema.prisma`
— no manual cleanup needed. New `addons.test.ts` (8 tests, register →
list → enabled-by-default/default-config → PATCH incl. 400/404 →
DELETE incl. 404) — this route file had **zero** test coverage before
this pass, despite being a fairly sophisticated board-only system
(moderation, MinIO-backed bundle upload/versioning).

**Found and fixed while testing:** the shared local dev Postgres
(`infra-postgres-1`, port 5432) was missing the two governance
migrations from this session's earlier PRs #484/#487
(`governance_notice_delivery_minutes_publish_resolution_link`,
`governance_conflict_declarations`) — `prisma migrate status` showed
them (and 146 other older migrations going back to June) as
"not yet applied" despite the live schema clearly having most of that
history's tables already, meaning `_prisma_migrations` bookkeeping on
this shared dev DB is badly out of sync with its actual schema (`migrate
deploy` refuses with P3005, "needs baselining"). Applied just this
session's own two migrations' SQL directly and marked them resolved,
narrowly — did **not** attempt to baseline or fix the other 146, that's
a separate, bigger job. This was silently failing `resolutions.test.ts`
(500s from missing `binding`/`meetingId` columns) for anyone running the
full suite locally against the shared dev DB; now passes. Flagging here
since it likely explains other "flaky" local-only failures other
sessions may have hit without realizing why.

Full `apps/api` admin/governance/webhooks/transparency suite (40 files,
187 tests) green after the migration fix.

### 2026-09-11 — cloud-import-abstraction.md

PLAT-081 added the shared `CloudImportProvider` contract and a Google Drive
implementation for paged listing, streamed downloads, and token revocation.
The existing Google Drive worker now downloads through that boundary without
changing import persistence or transcoding. Added provider contract tests and
documented the WebDAV/Open Cloud Mesh extension decision. Also reconciled
PLAT-084, whose Tauri CORS allowlist and tests had already shipped on 2026-09-08.
While running the full gate, fixed `/transparency` exporting a custom `studio`
page prop rejected by Next.js: both public and Studio routes now render a shared
non-route content component.

### 2026-09-11 — STREAM-011 HLS spike

Reviewed the pinned Liquidsoap 2.2.5 HLS behavior and official format guidance.
The follow-up implementation added a browser-compatible 320 kbps AAC rendition
and generated `master.m3u8` plus `master-free.m3u8` with AAC/MP3
`#EXT-X-STREAM-INF` entries. True lossless HLS remains open pending a
version-pinned Liquidsoap upgrade and hls.js/Safari playback checks.

### 2026-09-08 — governance meeting-minutes upload

Board admins had no way to actually upload a minutes file — the meeting
PATCH route accepted a `minutesKey` string, but nothing generated one,
and the field was never turned into a fetchable download URL either.
Added `POST /api/admin/governance/meetings/:id/minutes/prepare-upload`
(mirrors the addon bundle-upload pattern: presigned PUT, client PUTs
the file, then finalizes via the existing `PATCH .../:id`); `meetingResponse`
now computes a presigned `minutesUrl` (forces `Content-Disposition:
attachment`) instead of leaking the raw storage key. Frontend wiring
(`uploadAdminGovernanceMinutes()` in the AGM admin tab, plus a
member-facing meeting detail page) already shipped in the sibling
`tahti-player` repo. No separate todo file was tracked for this task.
PR [#489](https://github.com/janiluuk/tahti-org/pull/489).

### 2026-09-12 — Configure sound fallback cache root

Worker's `sound-fallback-cache.ts` jobs (`warm-sound-fallback-cache`,
`sound-fallback-cache-sync`) read `SOUND_CACHE_ROOT`, but only the legacy
`ARCHIVE_CACHE_ROOT` was ever set in the Compose and Swarm worker manifests —
the jobs silently no-op every run (empty `cacheRoot` short-circuits before
touching Prisma) despite the `/archive-cache` volume being mounted, and the
summary log only fires when `downloaded>0`/`pruned>0`, so the gap never
surfaced as an error. Confirmed live: every channel's Liquidsoap stayed
permanently on the buggy `archive_remote_url` fallback branch (`file.exists()`
is only checked once, at channel spawn) because `/archive-cache` never got
warmed — this is what silenced tahti-radio. Set `SOUND_CACHE_ROOT` alongside
`ARCHIVE_CACHE_ROOT` in both `infra/docker-compose.stack.yml` and
`infra/docker-stack.yml`, keeping the legacy variable for older images during
rolling deploys.
