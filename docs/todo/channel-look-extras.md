# Channel look-extras persistence

Branch: `feat/channel-look-extras`

## Goal

Persist Channel Designer look extras that Nuclear currently keeps in
`localStorage` (`tahti.channelLookExtras.{slug}`) on the Channel model so
owner GET/PATCH and public channel/profile responses round-trip them.

## Plan

1. Add nullable/defaulted Channel columns for look extras not already covered
   by `colorSchemeJson` / `visualPreset` / `textLayer*` / slideshow / etc.
2. Extend `ChannelVisualPatchSchema` + `GET`/`PATCH /api/me/channel/visual`.
3. Expose the same fields on public `GET /api/channels/:slug` and profile
   channel payload (including `brandAccentPreset` where missing).
4. Migration + focused route/schema tests + worklog.

## Naming

- Designer `textOverlay*` ↔ existing `textLayer*` (no new columns; keep
  `/api/me/channel/text-layer`).
- Designer `playerOverlay*` is a separate player-stage overlay → new
  `playerOverlayMode` / `playerOverlayText` / `playerOverlayAlign`.
- `backgroundVisualPreset` is `String?` (ids like `INTERACTIVE_POINTS` are
  not in the Prisma `VisualPreset` enum).

## Status

Shipped on `feat/channel-look-extras` — see
`docs/worklogs/2026-09-04-channel-look-extras.md`.
