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

### Slice 4 — pro-audio-editor hooks

- `use-edit-history.ts`, `use-draft-autosave.ts`, `use-export-and-clip.ts`
- Main file **1838 → 1528**

### Slice 5 — player-context hooks

- `use-player-analyser.ts`, `use-listen-heartbeat.ts`, `use-player-keyboard.ts`,
  `use-player-document-title.ts`
- Provider **827 → 687**

### Slice 6 — sound-editor + collection-editor helpers

- `sound-editor.ts` aggregator → draft / source / render / publish + helpers
- `_collection-editor-utils.ts` (`formatDuration`, `itemTitle`, `itemThumb`, `toPlayerTrack`)

## Leftovers

- Further split `pro-audio-editor.tsx` (~1.5k) — canvas/redraw / transport UI
- Further thin `player-context.tsx` (~687) — `load` / queue body
- `_collection-editor.tsx` (~1.0k) — still large UI surface
- Optionally move channel-* plugins out of `meSoundRoutes` registration into
  `register-routes/studio.ts` for clearer ownership (behavior-neutral rename)
