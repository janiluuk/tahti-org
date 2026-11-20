# Event image gallery with captions

**Status:** partial

Artists can attach an ordered image gallery (with captions) to an event. API side
is on branch `feat/event-gallery`; the Tahti Player web client is built against
the same contract in `../tahti-player`.

## Contract

- `ArtistEvent.gallery: Array<{ url: string; caption: string }>`, default `[]`, order preserved.
- `POST /api/me/events` and `PATCH /api/me/events/:id` accept optional `gallery`.
  On PATCH a present `gallery` replaces the whole list; absent leaves it unchanged.
- Validation (`ArtistEventGallerySchema` in `@tahti/shared`): max 30 items; `url`
  required, trimmed, max 500 chars, `http(s)://` (same rule as `imageUrl`);
  `caption` trimmed, max 300 chars, may be empty, defaults to `''` when omitted.
  Errors use the usual 400 `{ error }`.
- Returned by every event serializer (`serializeArtistEvent`): `/api/me/events*`,
  `/api/me/event-invites`, `/api/channels/:slug/events`, `/api/v1/events`,
  `/api/v1/events/:id`, `/api/v1/events/upcoming`.

## Storage

`ArtistEvent.gallery Json @default("[]")` (migration
`20261120120000_artist_event_gallery`). The list is owned by one event, always
read and written whole, and never queried by item, so a JSON column matches the
other `Json` config/timeline columns and avoids a join on every event read.
Reads go through `parseArtistEventGallery`: a non-array value reads as `[]`,
invalid items are dropped.

## Done

- [x] Prisma column + migration
- [x] Shared zod schemas, create/update wiring, serializer, OpenAPI `ArtistEventSchema`
- [x] `apps/api/src/routes/me/events-gallery.test.ts`

## Left

- [ ] Web client (Studio event form + event page gallery) in `../tahti-player`
- [ ] On merge: fold into `HISTORY.md`, delete this file and its INDEX row
