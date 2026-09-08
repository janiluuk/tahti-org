# Dashboard Sounds: title overlay, artwork-tinted row, one-line controls

**Status:** implemented, pending manual browser verification and PR.

## Background

On `/dashboard/sounds`, four issues reported:

1. Track titles weren't visible on published rows using the waveform
   player. Root cause: a prior fix (`048866c5`, PR #466) moved the title
   out of the waveform overlay into the icon-packed `.ch-sound-controls-row`
   flex row to fix a *different* legibility bug (title text was obscured by
   the background visualizer). With `flex: 1; min-width: 0` competing
   against ~8-10 fixed-width icon buttons in a wrapping flex row, the title
   could be squeezed away entirely on the widths this page renders at.
2. The icon row (play/love/queue/download/repost/comments/report + the
   pin/rotation/playlist/tools cluster) could wrap to two lines once the
   title was sharing that row.
3. Embed-only rows (Mixcloud/Spotify/Hearthis-without-hosted-audio) showed
   the provider name twice: once as the cover-art corner badge
   (`sound-list__cover-embed-badge`) and again inside the embed row's own
   control (`embed-frame-mixcloud__badge` / mini-player `HEARTHIS` badge).
4. The row's background gradient came only from `resolveColorScheme`
   (extracted-palette or platform default swatch colors), with no visual
   tie to the artwork actually shown in the row's cover thumbnail.

## What changed

- `apps/web/src/components/sound-item-playback.tsx`: moved `titleOverlay`
  back into `.ch-sound-playback__wf-wrap` (over the waveform/visualizer)
  instead of the controls row.
- `packages/ui/src/styles/brand-channel.css`:
  - `.ch-sound-playback__title-overlay` (replaces `__title-area`):
    absolutely positioned over the bottom of the waveform, with its own
    bottom-to-transparent dark scrim (`rgba(6,8,16,…)`) so the title reads
    regardless of what's rendered behind it (idle waveform, water-ripple
    visualizer, any accent color) — this addresses the actual cause of the
    original "obscured by visualizer" bug more directly than moving the
    text away did.
  - `.ch-sound-playback__title` / `__subtitle`: back to white text +
    text-shadow (they're always over image/visualizer now, not page
    background, so theme `var(--text)`/`var(--muted)` no longer applies).
  - `.ch-sound-controls-row`: `flex-wrap: nowrap` (was `wrap`) plus
    `flex-shrink: 0` on children, so the icon cluster stays on one line now
    that the title no longer shares the row. No overflow/scroll was added —
    doing so would clip the absolutely-positioned "Tools" dropdown menu
    (`.sound-list__tools-menu`) that lives inside this row, since
    `overflow-x` != `visible` forces `overflow-y` to also clip per the CSS
    overflow spec. If a future narrow-viewport report shows the row
    overflowing its card, that dropdown needs to move out of the scroll
    context (e.g. render via a portal) before adding scroll here.
- `apps/web/src/app/dashboard/sounds/_sound-list.tsx`:
  - Row background (`sound-list__row` inline style) now layers the
    existing color-scheme gradient over `url(${cover})` (the track's own
    `bannerUrl`) when artwork exists, `background-size: cover`, falling
    back to the flat gradient when there's no artwork.
  - Cover badge (`providerLabel`) is suppressed when the row will already
    render its own inline provider badge (`play.embedUri && !play.audioUrl`
    — the Mixcloud/Spotify/Hearthis-embed-only branches in
    `sound-editor.tsx`), fixing the double label without touching the
    shared embed-row components (`_hearthis-embed-row.tsx` etc., which are
    also used on public collection pages where no cover badge exists, so
    they were left alone).

## Follow-up fixes found while spot-checking (same session)

Building a static CSS-only preview (see Verification below) surfaced two
more real bugs in the same code path, both fixed here:

5. `sound-editor.tsx`'s Mixcloud/Spotify (non-Hearthis) embed branch never
   set `data-tahti-ui="brand"` on its wrapper — unlike the other two
   playback branches right above it. `.embed-frame-mixcloud`/`__spotify`
   styles are scoped to `[data-tahti-ui='brand']`, so this branch rendered
   completely unstyled in the dashboard (raw inline text/button, badge and
   title overlapping). Fixed by adding the same `data-tahti-ui="brand"`
   attribute used by the other two branches.
6. Embed-only rows (Mixcloud/Spotify/Hearthis-without-audio) only got the
   pin/rotation/playlist/tools cluster in `.sound-list__row-actions` —
   missing Love/Download/Repost/Comments entirely, unlike hosted-audio
   rows. Added `LoveButton`, `SoundDownloadButton`, `RepostButton`,
   `TrackCommentsToggle` to both embed branches (gated on `channelSlug`
   being present, matching the hosted-audio branch's guard).
7. `.sound-list__cover` (`brand-studio.css`) used `align-self: stretch`,
   so the 96px-wide thumbnail stretched to match the row's full height —
   tall and narrow for the waveform-player rows, worse once the embed rows
   above got a full icon row and grew taller too. Changed to
   `aspect-ratio: 1 / 1; align-self: flex-start` — cover art (and the
   no-artwork gradient placeholder) is now always a clean 96×96 square,
   top-aligned, regardless of row height. Requested directly by the user
   after seeing the preview screenshot below.

## Verified

- `pnpm exec eslint` clean on all changed `.tsx` files.
- `pnpm exec tsc --noEmit` clean in `apps/web`.
- `pnpm exec prettier --write` applied.
- **Static CSS preview, not the real app**: no docker stack was brought up
  (repo has ~18GB free disk, no cached images — building the full
  `docker-compose.stack.yml` image set was judged too expensive/risky for
  this change). Instead built a standalone HTML file loading the real
  `brand-channel.css` + `brand-studio.css` with markup mirroring the actual
  React output (including the `data-tahti-ui` attributes, since those turned
  out to matter — see bug #5 above) and screenshotted it via
  claude-in-chrome. This caught bugs #5–7 above but is **not** a substitute
  for loading the real page: it doesn't exercise the `ActiveTrackStage`
  water-ripple visualizer behind the title overlay, real API data shapes,
  or actual mobile viewport widths.

## Not done / follow-ups

- Real in-app browser check still outstanding: log into `/dashboard/sounds`
  with a seeded account that has a hosted track with artwork, a Mixcloud or
  Spotify embed import, and confirm at a real mobile width. Needs either a
  local Postgres+Redis dev stack (`docker compose -f
  infra/docker-compose.dev.yml up -d postgres redis` per the README) with
  seed data and a login, or `make stack-seed` if disk space allows.
- No responsive check yet for whether the one-line icon row
  (`.ch-sound-controls-row`, still `flex-wrap: nowrap`, no scroll — see the
  overflow/portal note above) visually overflows its card at very narrow
  phone widths now that embed rows also carry more icons.
- The unrelated backlog captured in the same session —
  [[channel-mobile-chat-and-live-player-ux]] — is separate scope, not
  started.
