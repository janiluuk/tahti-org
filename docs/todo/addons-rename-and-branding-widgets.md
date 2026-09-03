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

### B.0 — findings that changed the original scope (session discoveries)

Before building anything, checked what already exists — it's more than the
original request assumed:

- **A logo already exists.** Settings → Artist info → Identity tab has a
  "drop a transparent PNG/WebP logo" uploader (`channel-identity-panel.tsx`,
  `prepareLogoUpload`) — alpha-preserving PNG/WebP already required, so the
  "can be alpha RGBA" ask was already true. But it's an _overlay stamp_:
  `User.logoUrl` + `logoPlacement` (`AVATAR` | `COVER` | `BOTH`, see
  `packages/shared/src/dto/avatar-theme.ts`) composites the logo onto the
  avatar and/or cover image. It is not a placeable Channel Designer element
  and has no size variants. Decision (asked): keep this feature exactly as
  it is; the new logo is a **separate** upload/field/section used only as a
  Channel Designer block — not a replacement.
- **Bio already supports long-form text.** `User.bio`, up to 5000 chars,
  edited in Settings → Artist info → Story tab (`ChannelBioPanel`). There
  was never a second "story" field. Decision (asked): don't add one — the
  actual gap was that public pages (`c/[slug]`, `u/[username]`) rendered
  the full bio with no cutoff. **Done and shipped** (see Status): added
  `ExpandableText` (`@tahti/ui`) — measures rendered height client-side,
  clamps to 160px with a "more…" toggle only when actually overflowing,
  wired into both bio render sites. No DB change.
- **The Channel Designer has no block/grid concept at all.**
  `_designer-sections.ts` is a hardcoded array of exactly 5 single-instance
  sections (Visual style, Header & backdrop, Slideshow, Links, Player
  overlay text) — each backed by its own dedicated settings on
  `User`/`Channel`, not by rows in a table. There is nothing resembling
  "add N items, size each, pack them into rows" anywhere in this app today.
  What was asked for (full/half/third-width blocks, multiple packed per
  row, starting with the new logo) means building that from scratch.
  Decision (asked, given the size of this): **full generalized block
  system** — not a logo-only special case — chosen over stopping here or
  over a single-purpose "logo section". The design below is deliberately
  type-extensible (logo and addons as the first two block types) but does
  **not** retrofit the existing 5 sections into blocks — they're stable,
  live, non-repositionable-by-nature settings (a color scheme isn't a
  "block"), and forcing them into a generic shape would be pure risk for
  no user-facing benefit. "Generalized" here means the block system itself
  is reusable for future block types, not that everything becomes a block.

### B.1 — Channel Designer block system (this is the big one; phase 1 of 5 done, see Status)

**Data model** — new table, additive, no touch to existing Designer
sections' storage:

```prisma
enum ChannelBlockType {
  LOGO
  ADDON        // references an existing AddonInstall (channel-scope)
}

enum ChannelBlockWidth {
  FULL
  HALF
  THIRD
}

model ChannelBlock {
  id        String            @id @default(cuid())
  channelId String
  channel   Channel           @relation(fields: [channelId], references: [id], onDelete: Cascade)
  type      ChannelBlockType
  width     ChannelBlockWidth @default(FULL)
  position  Int               @default(0)   // flat order; row-packing is
                                             // computed at render time from
                                             // (position order, width), not
                                             // stored as an explicit row/col
  configJson Json             @default("{}") // type-specific: LOGO -> { assetId }, ADDON -> { addonInstallId }
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  @@index([channelId, position])
  @@schema("core")
}
```

Row-packing is a pure function of the ordered `(width)` sequence — greedily
fill a row (FULL alone; HALF+HALF; THIRD+THIRD+THIRD; THIRD+THIRD+... with
leftover space unfilled) rather than storing row/col explicitly, so
reordering never needs a second write to fix up row numbers. Same function
runs client-side (editor preview) and server-side/SSR (public channel page)
— put it in `packages/shared` so both import the identical implementation
rather than risking drift between an editor preview and the real render.

**Logo asset**: new `ChannelBlockAsset` upload (or a `blockLogoUrl` +
size-variant columns on a per-block basis, since configJson can't hold
binary) — mirror the _existing_ avatar/cover derived-size pipeline (find
and reuse whatever generates their size variants today; don't invent a
second image-processing path). Alpha-preserving PNG/WebP, same validation
as the existing logo uploader.

**Editor UI**: new Designer section (e.g. "Brand blocks", `id: 'blocks'` in
`_designer-sections.ts`) — a list of blocks with add/remove, a width
selector (Full/Half/Third) per block, and reordering (the repo already has
a tuned drag-reorder primitive — `packages/ui/src/brand/SortableList.tsx`,
used by Addons installs and the broadcast rotation queue — reuse it rather
than building another one). "Add block" starts with the two types above.

**Public rendering**: on `c/[slug]/page.tsx`, fetch the channel's
`ChannelBlock` rows, run the shared packing function, render a CSS grid/flex
row per packed group. `LOGO` blocks render the sized logo image; `ADDON`
blocks render `AddonFrame` (reused from the Addons work) pointed at that
`AddonInstall`.

**API surface**: `apps/api/src/routes/me/channel/blocks.ts` — list/create/
patch(width, position, configJson)/delete, artist-owned (`requireArtist`),
same shape as the existing `me/addons.ts` channel-install routes.

**Phasing if picked up fresh**: (1) migration + shared packing function +
its own unit tests (pure function, easy to test thoroughly without a DB);
(2) API CRUD; (3) editor UI; (4) public rendering; (5) logo upload +
size-variant pipeline wired into a LOGO block. Steps 1–2 and 5 can run
before there's any UI to exercise them, verified via API tests, like the
rest of this session's work.

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
- Workstream B: bio truncation (see B.0) done and merged — `ExpandableText`
  (`packages/ui/src/lib/ExpandableText.tsx`) wired into `c/[slug]` and
  `u/[username]`. Typecheck/lint/format green.
- Workstream B.1 (Channel Designer block system: logo + addon blocks,
  full/half/third width, row-packing) — phase 1 of 5 done (see B.1 phasing
  above), on branch `addons-branding-blocks` (worktree
  `../tahti-org-worktree-addons-branding-blocks`): migration
  `20260904020000_channel_blocks` (`ChannelBlock` table +
  `ChannelBlockType`/`ChannelBlockWidth` enums, both `core` schema, FK to
  `channel.Channel`, matches the `AddonInstall`/`ChannelVisualPreset`
  cross-schema-FK precedent already in this schema) and the shared
  `packBlocks` row-packing function (`packages/shared/src/channel-blocks.ts`
  - DTO/zod schemas in `dto/channel-blocks.ts`), with 8 unit tests covering
    FULL-alone, HALF/HALF, THIRD/THIRD/THIRD, the "leftover space unfilled"
    case, a width-change mid-list, and input-order preservation. Verified:
    `prisma validate`/`generate` succeed, `packages/shared` typecheck/lint/
    test green (8/8), `packages/db` typecheck green. `prisma migrate deploy`
    could not be exercised against a real Postgres this session — the local
    instance has no schemas bootstrapped (`stack-up.sh --seed` never run
    here) and fails replaying an unrelated 2026-06-05 migration before it
    even reaches this one; same class of local-DB limitation as A.2's
    session note. CI is the real gate for the migration SQL itself.
    Remaining: phase 2 (API CRUD, `apps/api/src/routes/me/channel/blocks.ts`),
    phase 3 (editor UI, reuse `packages/ui/src/brand/SortableList.tsx`),
    phase 4 (public rendering on `c/[slug]`), phase 5 (logo upload +
    size-variant pipeline, reuse the existing avatar/cover pipeline).
