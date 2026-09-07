# Stream overlay: scrim (darkening layer) toggle (backend)

**Status:** backend done (2026-09-07). Frontend (tahti-player) toggle UI
is a separate change in that sibling repo — see its own `docs/todo/`
entry.

## Background

Cross-repo blocker queued in `../tahti-nuclear/packages/tahti-web/WORKPLAN.md`
and `docs/todo/stream-overlay-text-color.md`: the multistream RTMP mirror
overlay (`buildRtmpMirrorOutput`) had no way to darken the cover art
behind the baked title/subtitle text for readability — the "scrim" only
existed as a CSS gradient in the frontend's own preview, never in the
actual broadcast video. Same off-by-default pattern as the existing
`streamOverlayShowTitle` toggle (`docs/todo/stream-overlay-show-title-toggle.md`).

## What shipped

- `packages/db/prisma/schema.prisma`: `Channel.streamOverlayScrimEnabled
  Boolean @default(false)`. Migration
  `20260907010000_channel_stream_overlay_scrim`.
- `packages/shared/src/dto/rtmp-targets.ts`:
  `ChannelStreamOverlayPatchSchema` gained `streamOverlayScrimEnabled:
  z.boolean().optional()`.
- `apps/api/src/routes/me/sound.ts`: GET/PATCH
  `/api/me/channel/stream-overlay` select and patch the new field.
- `services/orchestrator/src/liquidsoap.ts`: `buildRtmpMirrorOutput`
  gained a `scrimEnabled` param. When true and there is title or
  subtitle text to render, inserts `video.add_rectangle(color=0x000000,
  alpha=0.5, width=1280, height=110, x=0, y=610, ...)` between the base
  cover image and the text layers — a dark bar behind the bottom strip
  both text lines already render into, not the whole frame. No scrim
  when there's no text (nothing to read against).

## Verification approach (no guessing at Liquidsoap syntax)

`video.add_rectangle` was not previously used anywhere in this codebase.
Rather than guess at its signature, confirmed it against the real
`savonet/liquidsoap:v2.2.5` image (already available locally as a
running container from this environment's own channel containers):

- `docker run --rm savonet/liquidsoap:v2.2.5 --list-functions` confirms
  `video.add_rectangle` exists.
- `--list-functions-md` gives its exact signature: `(?id, ?alpha, ?color,
  height, width, ?x, ?y, source) -> source`.
- `docker run --rm -v <script>.liq:/check.liq savonet/liquidsoap:v2.2.5
  --check /check.liq` (exit 0 = valid syntax, confirmed a deliberately
  broken script exits 1 with a real parser error) validated the exact
  nested-call form `buildRtmpMirrorOutput` generates, including with the
  real `video.add_image`/`video.add_text` calls it composes with.

## Verification

`packages/shared`, `apps/api`, `services/orchestrator`: `tsc --noEmit`
and `eslint` clean on every touched file. `liquidsoap-mirror.test.ts`:
19/19 pass (3 new: scrim present with title text, scrim omitted with no
text even when enabled, scrim omitted by default). `sound.test.ts`:
14/14 pass against an ephemeral `postgres:16-alpine` (added
`streamOverlayScrimEnabled` assertions to the existing set/clear
round-trip test). `api-client generate` produced no diff — this route
has never declared a typed OpenAPI response schema.

## Not done here (frontend, sibling repo)

- Toggle UI in `StreamOverlayEditor.tsx`.
- `OverlayTextPreview` should visually show the scrim when enabled, so
  the editor's preview matches the real broadcast output.
- `StreamOverlay` type / mock fallback values in `tahti-web` need
  `streamOverlayScrimEnabled` added.
