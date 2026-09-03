# Disco-widgets → Addons rename, default-enablement, and branding widgets

Worktree: `worktree-addons-and-branding`. Two related workstreams sharing this
branch because both touch the Channel Designer / widget-placement surface.

## Workstream A — rename DiscoWidget → Addon (full rename, chosen over UI-label-only)

Renames the existing sandboxed-widget subsystem throughout the stack. Not a
new feature — `defaultConfigJson` (admin sets starting config for new
installs) already exists on `DiscoWidget`; this workstream is the rename plus
one new field (`enabledByDefault`, see Workstream A.2).

### A.1 — Mechanical rename

- DB: `packages/db/prisma/schema.prisma` — `DiscoWidget`→`Addon`,
  `DiscoWidgetVersion`→`AddonVersion`, `DiscoWidgetInstall`→`AddonInstall`,
  `DiscoWidgetScope`→`AddonScope`, `DiscoWidgetStatus`→`AddonStatus`. New
  migration with `ALTER TABLE ... RENAME TO` / `ALTER TYPE ... RENAME TO`
  (no `@@map` currently, table names = model names). Never touch already-
  applied migration files under `packages/db/prisma/migrations/` — only add
  a new one.
- Shared DTOs: `packages/shared/src/dto/disco-widgets.ts` → `addons.ts`,
  every `DiscoWidget*` schema/type/const renamed (`DISCO_WIDGET_SCOPES` →
  `ADDON_SCOPES`, etc.), re-exported from `packages/shared/src/index.ts`.
- API: `apps/api/src/lib/disco-widgets.ts` → `addons.ts`;
  `apps/api/src/routes/disco-widgets/*` → `routes/addons/*`;
  `apps/api/src/routes/admin/disco-widgets.ts` → `admin/addons.ts`;
  `apps/api/src/routes/me/disco-widgets.ts` → `me/addons.ts`; route paths
  `/api/disco-widgets/*` → `/api/addons/*` (and admin/me equivalents);
  `apps/api/src/server.ts` registration updated. Regenerate
  `packages/api-client/src/schema.d.ts` after.
- Web: `apps/web/src/app/admin/disco-widgets/` → `admin/addons/`;
  `apps/web/src/app/help/disco-widgets/` → `help/addons/`;
  `apps/web/src/components/disco-widgets/` → `components/addons/` (each
  `disco-widget-*.tsx` file renamed `addon-*.tsx`); dashboard/channel/listen
  files renamed and updated (`channel-disco-widgets-*` →
  `channel-addons-*`, `_disco-widgets-section.tsx` → `_addons-section.tsx`);
  nav labels and copy in `admin-nav.tsx`, `help/page.tsx`, marketing page,
  `settings/discovery/page.tsx`, `u/[username]/page.tsx`.
- SDK: `packages/widget-sdk/` → `packages/addon-sdk/`, package renamed
  `@tahti/widget-sdk` → `@tahti/addon-sdk`, `DiscoWidgetHostApi` →
  `AddonHostApi`, `DiscoWidgetModule` → `AddonModule`. Check
  `apps/web/src/app/widget-sandbox/**` routes — keep the sandbox iframe
  route path as-is unless trivial to rename (it's an internal bundle-serving
  endpoint, not user-facing; low priority).
- Docs: `docs/guides/plugins-and-addons.md` "Discovery and channel widgets"
  section already uses "Add-ons" as the umbrella term and only needs its
  "Disco-widgets" subsection heading/wording updated, not restructured.
  `docs/api/README.md`, `docs/flows/board-member.md` link/name updates.

Verify after: `pnpm typecheck`, `pnpm lint`, `pnpm format`, targeted
`pnpm test` for the renamed routes/dto, then a full `pnpm test` run against
a real local Postgres (local `tahti` DB was missing during this session —
CI provisions its own, so CI is the real gate; see session notes).

### A.2 — `enabledByDefault` (flat default, chosen over conditional triggers)

- New `Addon.enabledByDefault Boolean @default(false)` column (same
  migration as A.1's rename).
- Admin catalog row (`AdminAddonsPanel`, ex-`AdminDiscoWidgetsPanel`) gets a
  toggle next to the existing "save current config as default" action.
- Surfaces that currently require an explicit `AddonInstall` row to render a
  widget (listen page discovery section, channel page, homepage) instead
  fall back to: any `APPROVED` addon with `enabledByDefault=true` and no
  explicit install-row override (a user/artist can still install to
  override position/config, or explicitly disable one that's on by
  default — needs an explicit "hide this default addon" affordance,
  probably a disabled `AddonInstall` row acting as an override/suppression
  record rather than only meaning "not installed").
- Conditional triggers (e.g. "only default-show the internet-radio widget
  if a station is actually configured") are explicitly deferred — flat
  platform-wide default only, per this session's scoping decision.

## Workstream B — artist branding: logo, bio/story, Channel Designer sizing

Independent of the rename except for sharing the Channel Designer's
widget-placement grid.

- **Artist logo**: new upload separate from gallery/avatar. Store as PNG/
  WebP preserving alpha (no flattening onto a background) so it composites
  over channel background art. Needs size variants — mirror however avatar/
  cover already generate derived sizes (check existing upload pipeline
  before inventing a new one).
- **Bio + Story**: `bio` (existing, short) stays; add a longer `story` field
  (rich/long text). Any surface rendering long text (story, and reuse for
  bio if also long) truncates at a cutoff with a "more…" expand affordance
  rather than hard-cutting.
- **Channel Designer sizing**: logo (and likely other Channel Designer
  widgets generally, not just the logo) gets width variants — full, half,
  1/3 — and the grid packs multiple widgets per row when their combined
  width fits (i.e. a real flex/grid layout, not a fixed single-column
  stack). Check whether the Channel Designer's existing panel/grid system
  (`channel-header-panel.tsx`, brand/PageHero work from the prior worktree)
  already has a layout primitive this can reuse before building a new one.

## Status

- A.1 mechanical rename: done and merged to main. DB migration
  (`20260904010000_rename_disco_widgets_to_addons`) renames the tables/
  enums and adds `Addon.enabledByDefault`. Verified: typecheck/lint/format
  green across all 17 packages, API build + OpenAPI/SDK regen succeed.
- A.2 `enabledByDefault`: done. `resolveAddonRenderSet` (apps/api/src/lib/
  addons.ts) is the shared merge — explicit enabled installs plus any
  APPROVED+enabledByDefault addon with no install row at all for that
  owner (an install row, even disabled, is how an owner overrides/
  suppresses a default) — used by all three render feeds in
  routes/addons/public.ts (channel/ARTIST, homepage/ADMIN, discover/
  LISTENER). Default-only renders use a synthetic `default:<addonId>`
  installId (confirmed unused beyond a React key). Admin catalog row
  (`_admin-addons-panel.tsx`) has a StudioSwitch toggle next to Disable.
  New API test coverage: `apps/api/src/routes/addons/public.test.ts`
  covers a default rendering with no install, and a disabled install row
  suppressing it. Typecheck/lint/format green; local Postgres unavailable
  this session (port 5432 already held) so these new test cases are
  unverified locally — CI is the real gate.
- Workstream B (branding: logo, bio/story, Channel Designer sizing): not
  started.
