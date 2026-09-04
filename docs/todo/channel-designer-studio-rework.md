# Studio Channel Designer — uploads + section dropdown + help

## Goal

Rework `/dashboard/channel/edit` (core Studio) so it is usable:

1. Section **dropdown** (background, header/backdrop, player, tracks, collections, releases, …) instead of a tall vertical nav of instructional chrome.
2. **In-editor uploads** via `FileDropzone` — multi-image gallery DnD; video files auto-set header style to `VIDEO_LOOP`.
3. **Always-available page/background color pickers** (not buried behind visualizer ≠ MINIMAL / brand swatches only).
4. Move instructional copy into a collapsible **help** layer; forms stay compact.

## Status

Implemented on `feat/channel-designer-uploads-help` (2026-09-04).

## Verify

1. Open `/dashboard/channel/edit` — section dropdown at top of panel; no left vertical section list in the editor grid.
2. Background: change Background color — live preview wash updates (not stuck purple).
3. Header / backdrop: drop multiple JPGs into gallery dropzone; drop MP4 → header style becomes video loop.
4. Help (?) expands section instructions; forms have no long annotation paragraphs.
