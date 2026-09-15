# Discography (Tracks tab) row rework

Status: implemented, needs review/PR.

## What was broken

`/u/[username]`'s Tracks tab (`_tracks-tab.tsx`) wraps its `LibraryBrowser`
toolbar and source-filter pills in a `<div data-tahti-ui="studio">` to reuse
`.sound-list__*` styling — but that styling only exists in
`brand-studio.css`, which `apps/web/src/app/u/layout.tsx` never imported
(only `brand-channel.css` + `shells.css`). Same gap in
`apps/web/src/app/c/layout.tsx` (used by the mixed-collection embed rows,
`_sound-track-row.tsx` / `c/[slug]/page.tsx`), which also never imported
`brand-studio.css`. Net effect on both public routes: the filter pills,
search box and sort `<select>` rendered with raw browser defaults —
unstyled, no responsive wrap at 640px — which is what read as "buttons all
over the place" and "mobile completely broken." Track title/meta text itself
was always correctly styled (`brand-channel.css`, always loaded); it wasn't
literally invisible, just overwhelmed by the unstyled toolbar mess above it.

Confirmed via a throwaway `/dev/tracks-tab-demo` harness (not committed) that
mirrored each layout's actual CSS imports at 375px width — added
`brand-studio.css` to both layouts and the toolbar/pills started wrapping
and sizing correctly, matching the existing `/dev/components` playground
pattern that already pairs the two files.

Also found (not part of the original report but same row): each row had
*two* overlapping play buttons — a standalone round `.prof-collection-play`
button plus the cover+title `<button>`, both bound to the same toggle and
same aria-label.

## What changed

- `apps/web/src/app/u/layout.tsx`, `apps/web/src/app/c/layout.tsx`: import
  `brand-studio.css` (root-cause fix for the toolbar/pills).
- `apps/web/src/app/u/[username]/_tracks-tab.tsx`: extracted the per-row
  markup into a `TrackRow` component (needed its own hook call — see below).
  Removed the redundant standalone play button; the play/close trigger now
  lives as a hover-reveal overlay on the cover art itself (`.prof-collection-
  cover-play`), visible on hover/focus on pointer devices and always-visible
  at reduced opacity on touch devices (`@media (hover: none)`), full opacity
  while expanded. Same structure for local and embed-sourced tracks.
- `apps/web/src/lib/use-cover-accent.ts` (new): client-side canvas sampling
  of each track's cover art to derive an accent/highlight color pair, cached
  per URL. No server-side per-track palette exists (only `Collection` gets
  `paletteJson` via `apps/api/src/lib/palette-extract.ts`), so this reuses
  the already-loaded cover image instead of adding backend storage. Silently
  yields no glow on CORS-tainted or missing covers.
- `packages/ui/src/styles/brand-channel.css`: cover art bumped 76px → 92px;
  `.prof-collection-row--chroma` now also glows by default (ambient
  gradient + box-shadow), not just on hover — reusing the existing chroma
  variable contract (`--collection-accent`/`--collection-highlight`) that
  was previously wired up in CSS only and unused by any component.

## Not done / follow-up

- Not manually verified against a real seeded profile (no local Postgres
  in this session) — only the throwaway harness above. Worth a real
  browser click-through once there's a DB to point at.
- The cover-play button and the title clickarea button still share one
  aria-label each ("Play X" / "Close X") — pre-existing duplication, not
  introduced here, but a screen-reader user still tabs through two buttons
  with the same accessible name per row.
