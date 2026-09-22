# E2E screenshot atlas + richer fixture data

Status: **open, not started**

## Ask (from Jani, 2026-09-22)

- Re-run the e2e screenshot capture with richer seed data so every screen
  shows realistic/full content (no empty states) instead of the current thin
  demo fixtures.
- Capture at **1280px width** (current scripts capture at whatever the
  existing viewport list is — check `scripts/capture-e2e-screenshots.mjs`
  and `scripts/capture-mobile-screenshots.mjs`; confirm current widths and
  add/adjust a 1280 viewport).
- Modify the capture script so screenshots are also published to a
  **"Tahti Atlas" page** — a persistent gallery (likely a Claude Artifact,
  since this repo has no existing "atlas" concept — grepped, nothing found)
  where Jani can leave comments on each screenshot that persist across
  sessions.
- Workflow: Jani comments on each screen in the Atlas page → Claude reads
  those comments back in a later session (via `ArtifactComments` or
  `Artifact` read) and relays/applies the commentary here.

## Open questions to resolve before implementing

- "Tahti Atlas" doesn't exist yet anywhere in the repo or docs — confirm
  with Jani whether this should be:
  - a Claude Artifact (HTML gallery, one screenshot per section, using the
    `db`/`comments` capability so comments persist and are readable via
    `ArtifactComments`), published fresh each capture run, **or**
  - a page inside `apps/web` (e.g. `/admin/...`) with its own comment
    storage in Postgres.
  - Given "so I can comment them persistently and copy the commentary back
    here" strongly suggests the Artifact route (comments land in
    `ArtifactComments`, readable by Claude directly) — default to that
    unless told otherwise.
- Which journeys/fixtures need "richer" data — likely
  `apps/api/scripts/seed-e2e-screenshots.ts`; needs a pass to add more
  releases/episodes/listeners/grants/etc. so list/grid views aren't empty.
- Confirm 1280px replaces or supplements the existing capture widths (check
  `docs/e2e-screenshots/` and `docs/e2e-screenshots-mobile/` for current
  dimensions before assuming).

## Rough plan

1. Beef up `apps/api/scripts/seed-e2e-screenshots.ts` with more realistic
   volume per entity so every captured screen has populated lists/grids.
2. Add/adjust a 1280px desktop viewport in
   `scripts/capture-e2e-screenshots.mjs` (and confirm mobile script is
   unaffected).
3. After capture, publish (or update) an Artifact gallery page listing every
   captured screenshot (grouped by journey/category, per
   `docs/e2e-screenshots/` structure), with the artifact's `comments`
   capability enabled.
4. Document the round-trip: Jani comments in the Atlas → next session reads
   comments via `ArtifactComments` and reports/applies them here.

See `docs/testing.md` and `docs/e2e-screenshots/` for current capture
conventions before changing the scripts.
