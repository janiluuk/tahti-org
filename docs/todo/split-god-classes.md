# Split god classes (collections, mini-player, player, sound)

**Status:** in progress on `refactor/split-god-classes` (from latest `main`).

## Goal

Break oversized modules into focused files without behavior changes.

## Shipped

### Slice 1 — collections API

- `helpers.ts`, `rss.ts`, `me.ts`, `theme.ts`, `public.ts`
- Thin aggregator `collections.ts` (still default-exported to `register-routes`)

### Slice 2 — mini-player UI

- Folder `apps/web/src/components/mini-player/`
- Types, format-time, playback-details hook, QueueThumb, VolumeIcon,
  EmbedPlayerModal, FullPlayerSheet, MiniPlayer
- Public API via `index.ts`: `MiniPlayer`, `formatTime`

### Slice 3 — player context + me/sound + editor chrome

- `player-types.ts`, `player-hls.ts` (provider stays in `player-context.tsx`)
- `sound.ts` aggregator → `sound-crud`, `sound-visual-access`, `sound-export`,
  plus channel look routes extracted from the same god file
  (`channel-gallery`, `channel-text-layer`, `channel-visual`, `channel-stream-overlay`)
- `pro-audio-editor-controls.tsx` (`cx`, `Switch`, `ChainTile`)

## Leftovers

- Further split `pro-audio-editor.tsx` (~1.8k) — canvas/redraw, export, clip dialog
- Further thin `player-context.tsx` Provider (~827) — load/queue/heartbeat hooks
- `sound-editor.ts` (~575), `_collection-editor.tsx` (~1k) still large
- Optionally move channel-* plugins out of `meSoundRoutes` registration into
  `register-routes/studio.ts` for clearer ownership (behavior-neutral rename)
