# Tahti v8 — UX overhaul + import sources + audio editor

Sixteen PNGs covering the UX overhaul views, import flows for Google Drive / Mixcloud / Spotify, and the pro audio editor. Drop these into `docs/reference-screenshots/`. PRs don't merge until the rendered route is visually indistinguishable from the matching reference at 1280×900.

Rendered at 2× DPI, v8 tokens throughout.

## Files

### UX overhaul set (01–10)
- `01-dashboard-current.png` — Dashboard widget farm (before, what to fix)
- `02-dashboard-proposed.png` — Go Live hero + 3 KPIs + 2 broadcasts (after)
- `03-broadcasting-step-1-credentials.png` — RTMP + Icecast credentials
- `04-broadcasting-step-2-test-signal.png` — Live meters + codec/SR/latency
- `05-broadcasting-step-3-preview.png` — Self-monitor at FLAC quality
- `06-broadcasting-step-4-go-live.png` — Big green GO LIVE + summary
- `07-broadcast-live-mode.png` — Flight-deck dashboard while live
- `08-channel-designer.png` — Live preview + controls (Squarespace pattern)
- `09-stats-reframe.png` — Hero number + narrative + 3 follow-ups
- `10-archive-focused-rows.png` — One row, one action per state

### Import sources + mixed collections (11–15)
- `11-import-google-drive.png` — Drive picker modal: audio files, multi-select, OAuth
- `12-import-mixcloud-rescue.png` — Mixcloud rescue migration with honest quality labels
- `13-spotify-search-add-to-collection.png` — Spotify search modal, embed-only inclusion
- `14-collection-editor-mixed-sources.png` — Tahti FLAC + Spotify + Mixcloud rows side by side
- `15-public-collection-mixed-sources.png` — Listener view: three player types visually distinct

### Pro audio editor (16)
- `16-pro-audio-editor-v3-2.png` — Horizontal plugin chain + full-width focused EQ panel

## Load-bearing design rules

- Hero answers "what state is this in?" — top 40% of every view.
- One primary action per view. Verb-labeled. Largest cyan/green button.
- Meaning-bound colors. Never reassign.
- Source-aware embed cards in track lists. Three visually distinct treatments (Tahti dark, Spotify green, Mixcloud purple).
- Honest about transcoded/embed quality — banner everywhere it matters.
- Max font weight 500. `tabular-nums` for all numbers.
- Empty space is intentional.

## How to use these

These are conformance targets, not aspirations. Implementation briefs define what to build:
- `tahti-ux-overhaul-brief.md` for views 01–10
- `tahti-upload-and-collections-brief.md` for the upload entry
- `tahti-import-sources-brief.md` (new) for views 11–15
- `tahti-audio-editor-v3.2-brief.md` for view 16

The screenshots define what it looks like when correct. The smell test applies: 1-second comprehension, hero present, single primary action, can-remove-one, instrument vs form.
