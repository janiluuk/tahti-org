# Stream overlay: "show title" toggle (backend)

**Status:** backend done (2026-09-05). Frontend (tahti-player) toggle UI,
cover-image upload UX fix, and live preview are a separate change in that
sibling repo — see its own `docs/todo/` entry.

## Background

The multistream RTMP mirror overlay (`buildRtmpMirrorOutput`, baked video
frame pushed to YouTube/Twitch/etc. alongside audio) always rendered
title text — a custom `streamOverlayTitle`, or silently falling back to
the artist's display name when unset. There was no way to have no text at
all. User request: default that off; an artist opts in.

## What shipped

- `packages/db/prisma/schema.prisma`: `Channel.streamOverlayShowTitle
  Boolean @default(false)`. Migration
  `20260905040000_channel_stream_overlay_show_title`.
- `packages/shared/src/dto/rtmp-targets.ts`:
  `ChannelStreamOverlayPatchSchema` gained `streamOverlayShowTitle:
  z.boolean().optional()`.
- `apps/api/src/routes/me/sound.ts`: GET/PATCH
  `/api/me/channel/stream-overlay` select and patch the new field.
- `services/orchestrator/src/liquidsoap.ts`:
  - `buildRtmpMirrorOutput`'s `titleText` param is now optional; when
    omitted, no `video.add_text` call is emitted at all (previously
    always rendered, since the param was required).
  - Call site now passes `undefined` for both title and subtitle when
    `channel.streamOverlayShowTitle` is false — no display-name fallback
    either. When true, behavior is unchanged (custom text, or display
    name fallback if the title field itself is empty).

## Not done here (frontend, sibling repo)

- Toggle UI in `StreamOverlayEditor.tsx`, gating the title/subtitle
  `Input`s' visibility.
- Live preview of the cover with title/subtitle text overlaid, shown only
  when the toggle is on and at least one field has text.
- The cover-image upload UX fix (ready placeholder, hover remove/upload,
  modal-based upload) reported separately as a bug.

## Verification

`packages/shared`, `apps/api`, `services/orchestrator`: `tsc --noEmit`
and `eslint` clean on every touched file. `liquidsoap-mirror.test.ts`:
10/10 pass (added a case for the title-omitted/no-add_text-at-all path).
`sound.test.ts`: 13/13 pass against an ephemeral `postgres:16-alpine` +
`prisma db push` (added `streamOverlayShowTitle` assertions to the
existing set/clear round-trip test). `api-client`'s `schema.d.ts` was
regenerated but produced no diff — these two routes have never declared a
typed OpenAPI response schema, so nothing to update there.
