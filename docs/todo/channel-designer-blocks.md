# Channel Designer block system

**Status:** implemented (2026-09-06) — additive `ChannelBlock` table, packing
helper, artist CRUD + public feed, Designer section, public channel render.

Logo + addon blocks, full/half/third width, row-packing. Existing Designer
sections (visual style, header, slideshow, links, player overlay) stay as
dedicated settings — not retrofitted into blocks.

## Data model

New additive table, no touch to existing Designer section storage:

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
  position  Int               @default(0)   // flat order; row-packing computed at render
  configJson Json             @default("{}") // LOGO -> { assetId, url }, ADDON -> { addonInstallId }
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  @@index([channelId, position])
  @@schema("core")
}
```

Row-packing is a pure function of the ordered `(width)` sequence — greedily fill a row
(FULL alone; HALF+HALF; THIRD+THIRD+THIRD; leftover space unfilled). Same function in
`packages/shared` (`packChannelBlocks`) for editor preview and public render.

## Build

1. [x] Migration + shared packing function + unit tests.
2. [x] API CRUD: `apps/api/src/routes/me/channel-blocks.ts` (artist-owned, same shape as `me/addons.ts`).
       Public feed: `GET /api/v1/channels/:slug/blocks`.
3. [x] Editor: Designer section `blocks`, reuse `SortableList`.
4. [x] Public render on `c/[slug]/page.tsx` — `LOGO` image, `ADDON` via `AddonFrame`.
5. [x] Logo upload + existing `/api/me/media` pipeline into a LOGO block (alpha PNG/WebP).

## Verify

1. Open `/dashboard/channel/edit#channel-blocks` — add a PNG/WebP logo and an
   installed (or store) addon; drag to reorder; change widths.
2. Open `/c/[slug]` — blocks appear under the header, packed into rows.
3. `pnpm --filter @tahti/shared test` packing + DTO cases; API
   `channel-blocks.test.ts` against Postgres.
