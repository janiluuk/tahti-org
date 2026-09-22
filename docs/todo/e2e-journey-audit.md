# E2E journey reorg + audit

Status: in progress. Tracks the split of `tests/e2e/` into 4 category
directories (anonymous, listener, artist, admin), the redundant-test cleanup,
the new per-category Playwright screenshot journeys, and UI/perf/UX findings
surfaced while running them. Fold into `docs/todo/HISTORY.md` when the PR
merges; move any leftovers to `docs/remaining-work.md`.

## What shipped

- `tests/e2e/{anonymous,listener,artist,admin}/` — moved the persona bash
  journeys (was `tests/e2e/journeys/*.sh`) and the artist-only Playwright
  scripts into 4 category directories matching the product's actual roles.
- Folded `tests/e2e/journeys/dashboard-player.sh` into
  `tests/e2e/artist/artist.sh` (`run_artist_player_journey`) — it duplicated
  ~70% of `run_artist_journey`'s release/archive/dashboard assertions; kept
  only the checks unique to the player surface (download-gate stats, public
  channel items + `audioUrl`, embed metadata).
- New Playwright screenshot journeys, one per category, each capturing both
  light and dark `prefers-color-scheme` (browser-level emulation, not the
  product's per-artist channel theme picker):
  - `tests/e2e/anonymous/anonymous-journey.mjs`
  - `tests/e2e/listener/listener-journey.mjs`
  - `tests/e2e/artist/fresh-artist-journey.mjs` (existing script, retrofitted
    with `SCREENSHOT_THEME`)
  - `tests/e2e/admin/admin-journey.mjs`
  - Shared helper: `tests/e2e/lib/journey-capture.mjs`
- Viewport for all 4 journeys is 3440×1440 (per request), not the smaller
  1280×900 the older `capture-e2e-screenshots.mjs` full-route tool still uses.
- CI: replaced the single `user-journeys-e2e` job with 4 named jobs
  (`anonymous-journey-e2e`, `listener-journey-e2e`, `artist-journey-e2e`,
  `admin-journey-e2e`), each building/starting the web app and uploading its
  journey's screenshots as a workflow artifact.

## Flagged issues (found while wiring this up — not yet triaged/fixed)

1. **Bug — `apps/web/Dockerfile` can't build from a clean checkout.**
   `packages/api-client/src/schema.d.ts` is gitignored and only exists after
   `pnpm --filter @tahti/api-client generate` runs (which itself shells out to
   `apps/api`'s `openapi:export`). `apps/web/Dockerfile` copies
   `packages/api-client/src` and runs `cd apps/web && pnpm build` directly,
   never running `generate` and never copying `apps/api/src` in that stage —
   so `next build` fails with `Cannot find module './schema.js'` on a truly
   clean `docker build` / CI runner with no pre-populated `schema.d.ts` in the
   build context. `pnpm --filter @tahti/web dev`/`build` at the repo root
   works because turbo's task graph runs `generate` first (`turbo.json`); the
   Docker stage bypasses turbo entirely. Reproduced during this task via
   `./scripts/stack-up.sh --seed` on a fresh worktree — full log had:
   `Type error: Cannot find module './schema.js' or its corresponding type declarations.`
   Fix: add an `apps/api` COPY + `pnpm --filter @tahti/api-client generate`
   (or a full `pnpm turbo run build --filter=@tahti/web`) step to the builder
   stage before `next build`.
2. **Bug — Next.js "not found" route returns HTTP 200.** Already known and
   commented in `tests/e2e/artist/artist.sh` (`run_artist_subdomain_journey`):
   an unknown `*.tahti.live` subdomain renders the not-found page content but
   with a 200 status code, not 404. Carried over from the old
   `journeys/artist.sh`, not introduced here — flagging again because it's
   exactly the kind of thing this audit was asked to surface.
3. **UX gap — no light theme, confirmed byte-for-byte.** The web app has no
   `prefers-color-scheme: light` styling (grepped `apps/web/src` and
   `packages/ui/src` for `prefers-color-scheme` / `next-themes` / `data-theme`
   — none control a platform-wide light/dark mode; the only "themes" system
   is `/admin/themes` + `/dashboard/channel/edit`, which is per-artist channel
   branding, not an app shell theme). Confirmed empirically: after running
   all 4 journeys with `colorScheme: 'light'` vs `'dark'`, `cmp` shows the
   admin, artist, and listener screenshots are **byte-identical** between
   `light/` and `dark/` for every page checked (e.g.
   `admin/journey/{light,dark}/02-admin-dashboard.png`). The anonymous
   journey's `light/`/`dark/` pairs differ by a few dozen bytes only —
   almost certainly font-hinting/timestamp noise, not real theming. The new
   journeys still capture both folders per the request (and the review page
   shows both side by side specifically to make this gap visible), but until
   the shell reacts to `prefers-color-scheme`, `light/` will keep mirroring
   `dark/`. Worth a product decision: either add a real light theme, or drop
   the light capture and say so explicitly in the screenshots README.
4. **Bug — `tests/e2e/artist/fresh-artist-journey.mjs` was testing a wizard
   that no longer exists.** The channel setup wizard
   (`apps/web/src/app/dashboard/setup-channel/`) was redesigned into a real
   5-step flow (Identity → Genres & listing → Look → Rotation → Go live,
   `_wizard-steps.ts`); the journey script still looked for a single
   `Create <slug>.tahti.live` button that no longer exists anywhere in the
   UI, so it always timed out and never actually exercised channel creation.
   This is exactly the kind of "redundant/stale e2e test" this audit was
   asked to find — the test had been silently not testing what its own
   comments claimed for however long that redesign has been live. Fixed here
   by walking the real 5 steps (filling the identity description, submitting,
   skipping Look/Rotation via their own "Skip for now" links) — see the
   updated `02-setup-channel.png` / `02b-setup-channel-genres.png` captures.
5. **UX/reliability — login form submit occasionally no-ops on the first
   click.** Reproduced consistently while running all 4 journeys back to
   back (`/login`, `#auth-panel-login button[type="submit"]`): the first
   click sometimes doesn't navigate at all (`waitForURL` times out at 30s)
   while a second click on the same button immediately after succeeds.
   Consistent with a client-side hydration race — the button is visible and
   clickable before its submit handler has attached. Worked around in
   `tests/e2e/lib/playwright-auth.mjs` (`uiLogin`) and the 3 journey scripts
   with a one-click retry, but a real (non-robot) visitor clicking once and
   nothing happening — no loading state, no error — is a genuine UX papercut
   worth a product fix (e.g. disable the button until hydrated, or show a
   pending state on click).
6. **Perf/UX — mutation-endpoint rate limiting is tight for a legitimate
   rapid multi-release upload.** Creating 3 releases back-to-back and then
   PATCHing each one's visual preset (`fresh-artist-journey.mjs`'s normal,
   single-pass flow — not a retry loop) hit `429` on `/api/me/releases/:id`
   visual-patch and publish calls during this session's testing. That's
   ~9 mutating calls within a few seconds; a real artist bulk-importing a
   back-catalog (the exact scenario `docs/technical/journey-artist.md`
   describes) could hit the same wall. Worth checking whether the per-account
   mutation bucket for `/api/me/releases/**` is sized for realistic batch
   upload sessions, not just interactive single-release edits.
7. **Layout at 3440×1440 (ultra-wide).** No broken layouts observed in the
   captured screenshots, but every dashboard/admin page leaves most of the
   screen as empty background with content pinned to a narrower centered (or
   left-aligned) column — see e.g. `artist/journey/light/02-setup-channel.png`
   and any `admin/journey/*` capture. Not a bug, but worth a product decision
   on whether ultra-wide viewports should ever use the extra horizontal space
   (e.g. a wider dashboard/table layout) rather than always looking like a
   1280px design centered in more canvas.

## Remaining / follow-up

- `capture-e2e-screenshots.mjs` (the full manifest-driven, per-route
  capture tool used for `docs/e2e-screenshots/{public,free,member,artist,admin}/`)
  still uses the old 5-role model and a 1280×800 viewport; it was **not**
  folded into the 4-category model in this pass to limit blast radius on a
  635-line, actively-relied-on script. A follow-up could consolidate its
  `free`+`member` roles into `listener` to match the new category scheme.
- Annotated review page: see the artifact link left in the PR description /
  session summary once the real capture run completes.
