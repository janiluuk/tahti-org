# Todo history

Completed work lands here — **append, never overwrite**. Active work stays in `docs/todo/*.md`
(except this file). See `CLAUDE.md` and `.cursor/rules/todo-history.mdc`.

Each entry is a compact dated section (original filename + what shipped). Do not paste full
session transcripts. Leftover open items go to `docs/remaining-work.md` or a new todo file.

## 2026-09-16 — internet-radio-now-playing-scraper.md

Shipped (partial) in [#531](https://github.com/janiluuk/tahti-org/pull/531):
a 10-minute cron
(`apps/worker/src/jobs/internet-radio-now-playing-sync.ts`) that refreshes
`InternetRadioStation.currentProgramTitle`/`currentProgramArtist` for
stations a user has actually added — never the raw preset catalog — and
only for hosts with a working parser, so unsupported stations are skipped
without a wasted fetch on every tick. Two of the six Finnish presets are
implemented and verified against the live sites: **radiohelsinki.fi**
(server-renders the current show + song directly, no client fetch
needed) and **radioplay.fi** — Bauer Media, covers both **NRJ** and
**Radio Nova** (embeds a hydration state blob; takes the last non-empty
`stationNowPlaying` object, since earlier ones can be empty sibling-
station placeholders). Not implemented: **YleX** (Yle Areena is a fully
client-rendered SPA with nothing in the initial HTML; Yle's real
program-guide API needs a registered app key not available in this
session) and **Radio Rock**/**Suomipop** (Nelonen Media — no now-playing
data found in the static HTML or any obvious embedded state). Frontend:
`internet-radio-panel.tsx` shows the cached title/artist under each
station and links the station name to its `programmingUrl` (external)
for click-through. Remaining work (Yle app-key registration, a Nelonen
Media parser) moved to a fresh slim todo,
`internet-radio-now-playing-yle-nelonen.md`.

## 2026-09-16 — embed-track-manual-import.md

Shipped in [#528](https://github.com/janiluuk/tahti-org/pull/528): a manual
"Import" action in the track editor's Audio tab for `HEARTHIS_EMBED` tracks
(`POST /api/me/sound/:id/import-embed`), re-checking downloadability via the
hearthis.at API and re-enqueueing the existing localize-to-real-audio job on
demand. Also fixed a real bug found while investigating: the existing
automatic localize job never cleared `embedUri`/`embedProvider` or reset
`contentType` off `EMBED` once real audio landed, so even tracks localized
through the already-shipped automatic path kept rendering as embeds
everywhere. New `Sound.embedSourceUrl` column persists the original
hearthis.at track URL for the re-fetch (`embedUri` only holds the bare
numeric id used for the embed iframe). No leftovers — `SPOTIFY_EMBED`/
`MIXCLOUD_EMBED` genuinely have no download path to extend this to.

## 2026-09-16 — bloom-visualizer-preset.md

Shipped in [#530](https://github.com/janiluuk/tahti-org/pull/530): the
Backdrop preset system (`Channel.backgroundVisualPreset` /
`useBackgroundGradient` / `backgroundColorSchemeJson`) had been fully wired
through the API for a while but had zero frontend consumer — no picker, no
renderer, no per-preset settings storage. Built all three, shipping a
selective-bloom preset (Three.js `UnrealBloomPass`) as the first
implemented option: `BloomPreset` (glowing orbs, colored from the
channel's palette, speed/intensity/audio-reactive knobs reusing the
existing `{speed, intensity, scale, audioReactive}` settings shape via a
new `backgroundVisualSettingsJson` column), `ChannelBackdropVisualizer`
mounted on the public channel page (active only while nothing is
playing — the header preset already covers "what's on"), and
`BackdropPresetPanel` — a compact "Backdrop" section in the existing
Visual style dashboard panel, plus the live channel-editor preview. The
other three `BACKGROUND_VISUAL_PRESETS` ids (`INTERACTIVE_POINTS`,
`FAT_LINES`, `VIDEO_KINECT`, `BACKDROP_AREA`) remain reserved/
unimplemented — the picker only offers Bloom. Not manually verified in a
live browser (Chrome extension was disconnected this session) — verified
instead via a full curl-based round trip (login → PATCH → public GET)
confirming the settings persist and reach the public channel payload, plus
`pnpm ci:check` and new API test coverage (`channel-visual.test.ts`).

## 2026-09-16 — loading-indicators-playables.md

Shipped in [#529](https://github.com/janiluuk/tahti-org/pull/529): a single
shared `Spinner` component (`packages/ui`, `.ui-spinner--sm`/
`--md`) replacing three near-duplicate ad-hoc spinner CSS blocks
(`WaveformPlayer`'s `.waveform-player__spinner`, the mini-player's
`.mini-player__spinner`, and reusing the existing `waveform-player-spin`
keyframe under a generic name — `.studio-spinner`'s background-job spinner
left untouched, out of scope). Fixed a real gap in `use-player-load.ts`:
`buffering` was reset to `false` at the start of every `load()` call, so the
spinner only ever appeared after the browser's own `waiting` event fired —
often well after the click, with a dead-looking gap in between; now it's
`true` immediately (embeds excluded, they have no `<audio>` element to
derive it from). Wired the new spinner into: the mini-player collapsed bar
and full-player sheet's play buttons (already had ad-hoc spinners, now
sharing the same component), the queue panel's "Now playing" thumbnail
(previously had no loading state at all), `QueueThumb` for the rare
repeated-track-in-queue case, and the profile Tracks tab's cover-play
button. Added a `/dev/components` demo section. Not attempted: an
exhaustive audit of every other playable surface in the app (collection
rows, release rows, etc.) — flagged as follow-up if more turn up.

## 2026-09-15 — Motion PATCH: closeAt (voting-window adjustment)

Driven by `../tahti-player`'s `docs/todo/governance-gap-list.md` #15, not
a local todo file here. `PatchMotionSchema` (`packages/shared/src/dto/governance.ts`)
never accepted `closeAt` at all — added it, and `PATCH
/api/v1/governance/motions/:id` (`apps/api/src/routes/governance/index.ts`)
now applies it under the same DRAFT-only gate as title/description, with
`closeAt > openAt` validated the same way motion creation already does.
`openAt` stays fixed (not patchable — a draft hasn't opened, nothing to
reschedule the start of). 4 new cases in `motions.test.ts` (draft patch
OK, invalid `closeAt` 400s, blocked once OPEN with 409) — 11/11 green
against real Postgres. `eslint`/`tsc --noEmit` clean. Shipped in
[#525](https://github.com/janiluuk/tahti-org/pull/525).

## 2026-09-15 — mobile-player-nav-and-tahti-theme-visuals.md

Pointer-only file — the real work always lived in `../tahti-player`'s own
`docs/todo/` under the same filename. That side shipped it 2026-09-10
(workplan cycle 0.0.109): thumbnail glow via grid-level avatar wash + wider
`CardGrid` gap (per-card bleed abandoned), alongside a `tahti-theme-refactor`
Button call-site audit and the `tahti-dark` primary/secondary token pair
verification. This repo's pointer was never deleted after that shipped —
folding it now. No code changes on this side (this repo was always the
visual reference only, never the implementation target).

## 2026-09-15 — plugin-registry-extraction.md §6 test gaps

Closed the two remaining open rows in §6's test matrix, shipped in
`../tahti-player`'s [#85](https://github.com/janiluuk/tahti-player/pull/85):
`removeManagedPluginInstall` test coverage (plus a safety tightening found
while writing it — the guard only scoped to the whole appData dir, not the
plugins dir its own error message claims), and the `it.todo` for enable/
disable state surviving a simulated restart. The file itself stays open —
ownership-split sign-off and final extraction remain the real blocker, and
that's a product/architecture decision, not a code gap.

## 2026-09-15 — profile-branding-followups.md

Shipped in [#523](https://github.com/janiluuk/tahti-org/pull/523): five small
slices closing leftovers from three earlier merged PRs plus one direct
request. Wired `backdropUrl`/`nameplateText`/`nameplateColor` (exposed on the
public API by #522 but never rendered) into `ProfileHero`/`ProfileCover` and
the public `/u/[username]` page. Added an **Artist logo** section to Settings
→ Account → Branding — the underlying alpha-PNG `User.logoUrl`/`logoPlacement`
feature already existed end-to-end but its only upload UI lived in Settings →
Artist Info; added a second entry point reusing the same actions and the
existing AVATAR/COVER/BOTH placement enum. Added the crop step #522 left out
of the Channel Designer's own backdrop image upload. Backfilled two test
gaps: `pruneStaleWorkers()`'s 90-day cutoff (#520) and `GET
/api/admin/stats/cron-runs/history` (#515). All typecheck/eslint/prettier
clean; 22 tests passing (12 worker-registry, 10 admin-stats) against a real
Postgres. Not manually verified in a browser (no dev server in that session)
— worth a follow-up click-through of the Branding logo controls and the
Channel Designer backdrop crop.

## 2026-09-15 — channel-radio-show-now-playing-endpoints.md

Added `GET /api/v1/radio/show/:channelSlug/now-playing` and `GET
/api/v1/radio/show/:channelSlug/upcoming`, unblocking `tahti-player`'s
`listen-bugs-batch-2026-09-14.md` item #3 (RadioShowView.tsx now-playing/
upcoming). Reused the existing per-channel `nowPlayingTitle`/`...UpdatedAt`
columns (same 2-minute staleness window as `channels/get.ts`) and
`curatedRotationItem` queue-ordering logic already used by `/rotation` and
`nowPlayingNext`, rather than inventing a parallel data model. Both new
routes are scoped by `channelSlug` (any channel with a curated rotation),
not hardcoded to Tahti Radio. `upcoming` rotates the queue to start right
after the current track and drops the wrap-around duplicate of the current
track for short rotations (caught by a test, fixed before merge). 12/12
Vitest cases green against a real Postgres, plus `eslint`/`prettier`/
`tsc --noEmit` clean.

## 2026-09-15 — branding-nameplate.md

Shipped in [#522](https://github.com/janiluuk/tahti-org/pull/522): Settings →
Account → Branding panel (avatar/backdrop crop + nameplate pill). Generalized
the avatar-only crop modal into a reusable `ImageCropModal` (`aspectRatio` +
`shape` props) shared by the existing channel-identity avatar/logo crop and
the new backdrop crop. New `User.backdropUrl`/`nameplateText`/
`nameplateColor` columns, presign/upload/complete routes for the backdrop,
and `PATCH /api/me/profile` extended for the nameplate fields. 32 API tests
green. Follow-ups not in this PR, moved to `docs/remaining-work.md`: wiring
the new fields into the public `/u/[username]` hero, and a crop step for the
Channel Designer's own backdrop upload.

## 2026-09-15 — redis-memory-cleanup.md

Shipped in [#520](https://github.com/janiluuk/tahti-org/pull/520): prod
Redis `maxmemory 2gb` + `allkeys-lru` (previously unset — unbounded growth,
no eviction), bounded BullMQ `removeOnComplete`/`removeOnFail` retention
across `apps/api`/`apps/worker` queues, and `pruneStaleWorkers()` reaping
`workers:known` entries stale past 90 days. Left open: no unit test for the
90-day cutoff logic, moved to `docs/remaining-work.md`.

## 2026-09-12 — cron-runner-service.md

Shipped in [#515](https://github.com/janiluuk/tahti-org/pull/515): dedicated
`cron-runner` stack service owns BullMQ repeatable-cron registration so
worker replicas stop racing to delete/recreate the manifest — root cause of
a confirmed incident (duplicate `hls-minio-sync` registrations doubling
MinIO load, ~40s sync gaps). Adds bounded `CronRun.resultJson` plus a new
`GET /api/admin/stats/cron-runs/history` endpoint and `/admin/crons` admin
page. Fixed a zod `.int().positive()` schema that would have crashed
Fastify's ajv compiler at boot (same class of bug already worked around
elsewhere in the same file). Left open: no test for the new history route
(needs a live Postgres), moved to `docs/remaining-work.md`.

## 2026-09-12 — split-god-classes.md

Shipped in [#503](https://github.com/janiluuk/tahti-org/pull/503): split oversized
collections/sound/sound-editor routes, mini-player folder, player-context hooks,
pro-audio editor panels, collection editor chrome, admin files browser parts,
channel controls/identity, profile/about helpers, visual-preset thumbs, and
schedule add-show UI. Optional further peels (channel page ~759, pro-audio ~805,
tour-steps/seed scripts) left for later if needed.

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

### 2026-09-21 — `/listen` "Your feed" redesign (`listen-your-feed-redesign.md`)

Replaced the banner-vs-updates-list split in `_your-feed-section.tsx` with one
unified `FeedCard` for every item kind (post/release/track), and added a
`Reveal` progressive-disclosure component to `@tahti/ui` (`brand/Reveal.tsx`,
with tests) so items expand in place instead of the ad-hoc "Read more" toggle
and the old `FeedPostModal` (now `_feed-post-edit-modal.tsx`, edit only). Feed
CSS in `components.css` / `admin-ui.css` trimmed accordingly. Presentation
only — `FeedItem` data shape and `/me/feed` API unchanged. PR #535.

### 2026-09-21 — Cron consolidation (`cron-consolidation.md`)

Cut registered BullMQ repeatables 28 → 17 without dropping behaviour. Added
`CronJobSpec.subTasks` and `runCronTasks` (per-task CronRun rows, isolated
failures, optional `parallel`), then merged jobs into dispatchers:
`fan-sub-daily`, `membership-daily`, `weekly-monday`, `media-daily-sweeps`,
`media-minute-tick`, `light-minute-tick`, `media-ten-minute-tick` and
`light-daily`. Admin cron dashboard expands dispatchers into per-task rows.
PRs #539, #541. Prod verification moved to `remaining-work.md`.

### 2026-09-22 — Discography track rows (`discography-track-row-unify.md`)

Public `/u` and `/c` layouts never imported `brand-studio.css`, so the Tracks
tab toolbar/filter pills rendered unstyled and didn't wrap on mobile. Added the
import to both layouts, unified track rows into a `TrackRow` component with a
single hover-reveal play overlay on the cover (removed the duplicate play
button), and added `use-cover-accent.ts` (client-side cover colour sampling)
for the per-row glow. Open a11y nit: cover-play and title buttons still share
an aria-label. PR #526.

### 2026-09-22 — Studio + admin professional polish (`studio-admin-professional-polish.md`)

Adopted the existing `StudioCollapse`/`Panel`/`Badge` components across studio
and admin instead of hand-rolled `<details>` blocks and inline `style={{}}`:
~20 `<details>` → `StudioCollapse` (incl. credits/version panels, preflight
"More options", Green room, add-show "More details"), `Badge` gained
`warning`/`error` variants, extracted a shared `VendorCard` on the vendors
page, admin dashboard and governance-records inline styles moved to scoped
classes, dead `.studio-details*` CSS removed. `admin-nav.tsx` reviewed and left
alone (inherent icon table). Leftover: `GreenRoomPanel` heading redundancy
(moved to `remaining-work.md`). PR #533.
