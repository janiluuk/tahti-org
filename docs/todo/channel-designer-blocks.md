# Channel Designer block system

Open remainder of `addons-rename-and-branding-widgets.md` (A.1/A.2/B.0 shipped — see HISTORY).

Logo + addon blocks, full/half/third width, row-packing. Not started. Existing Designer
sections (visual style, header, slideshow, links, player overlay) stay as dedicated settings
— do not retrofit them into blocks.

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
  configJson Json             @default("{}") // LOGO -> { assetId }, ADDON -> { addonInstallId }
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt

  @@index([channelId, position])
  @@schema("core")
}
```

Row-packing is a pure function of the ordered `(width)` sequence — greedily fill a row
(FULL alone; HALF+HALF; THIRD+THIRD+THIRD; leftover space unfilled). Same function in
`packages/shared` for editor preview and public render.

## Build

1. Migration + shared packing function + unit tests.
2. API CRUD: `apps/api/src/routes/me/channel/blocks.ts` (artist-owned, same shape as `me/addons.ts`).
3. Editor: Designer section `blocks`, reuse `SortableList`.
4. Public render on `c/[slug]/page.tsx` — `LOGO` image, `ADDON` via `AddonFrame`.
5. Logo upload + existing size-variant pipeline into a LOGO block (alpha PNG/WebP).

Steps 1–2 and 5 can land before UI.
