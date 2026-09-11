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

### Slice 7 — five leftovers

1. **T1** `use-waveform-canvas.ts` — canvas/redraw/view helpers (**1523 → 1288** with T5)
2. **T2** `use-player-load.ts` + `use-player-queue.ts` (**687 → 448**)
3. **T3** `_collection-track-row.tsx` + `_collection-editor-settings.tsx` (**1004 → 696**)
4. **T4** channel gallery/text/visual/overlay register in `studio.ts`; `sound.ts` is sound-only
5. **T5** `pro-audio-editor-toolbar.tsx`

### Slice 8–10 — transport, chain, import chrome + dialogs

- `pro-audio-editor-transport.tsx`, `pro-audio-editor-chain.tsx`,
  `pro-audio-editor-dialogs.tsx` → main **1298 → ~922**
- `_collection-import-chrome.tsx` → collection editor **693 → 489**

### Slice 11–15 — waveform, metadata, channel page, admin files, studio panels

1. **S11** `pro-audio-editor-waveform.tsx` → pro-audio **922 → 805**
2. **S12** `_channel-page-types.ts` + `_channel-page-utils.ts` → channel page **887 → 759**
3. **S13** `sound-metadata/` folder + thin re-export barrel
4. **S14** admin files: filters / row / edit-modal / types → browser **860 → 488**
5. **S15** channel-controls icons/transport/playlist; channel-identity utils/media
   → controls **750 → 511**, identity **744 → 430**

## Leftovers

- Optional further peel of channel page (~759) or pro-audio (~805)
- Seed scripts (`seed-local-dev-catalog`, `seed-e2e-screenshots`) still large but out of product UI scope
