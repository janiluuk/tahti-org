# Listening parties

An artist schedules a one-time play of one of their releases. At `startAt`
the release plays once, start to finish, in track order; fans on the party
page hear the same track at the same point, read the liner notes, talk in the
host channel's chat and can buy from the artist's purchase tiers.

Digital-only v1. Formats, pre-orders and physical goods are a separate
project.

## Decisions

Moved to [`../DECISIONS.md` → Listening parties](../DECISIONS.md#listening-parties).

## Timeline

`computeListeningPartyTimeline({ startAt, tracks, canceledAt, now })` in
`packages/shared/src/listening-party-timeline.ts` returns
`{ state, endAt, nowPlaying: { trackId, position, offsetSec } | null }`.
`offsetSec` is fractional. tahti-web mirrors the same algorithm to tick between
polls, using `serverNow` from the DTO to correct its clock.

## Endpoints

Public:

| Endpoint | Notes |
| --- | --- |
| `GET /api/v1/listening-parties/:id` | `ListeningPartyDto`. 404 when missing or the host is suspended; canceled parties are returned. `Cache-Control: no-store`. |
| `GET /api/v1/listening-parties/:id/tracks/:trackId/stream` | 302 to a signed Opus URL. Pre-release: 403 unless `LIVE` and the track's position ≤ the current one; the URL lives for the track's length + 2 min (max 1 h). Public release: behaves like the normal track stream (purchase/subscriber gate of a linked Sound, 1 h URL). 404 for a track not on the release. |
| `GET /api/channels/:slug/listening-parties` | `{ items: ListeningPartySummaryDto[] }`: `LIVE` then `SCHEDULED`, soonest first, max 10. |

Artist (session, host of the release and of the channel):

| Endpoint | Notes |
| --- | --- |
| `POST /api/me/listening-parties` | Body `{ releaseId, startAt, hostNote? }` → 201 `ListeningPartyDto`. 400: `startAt` under 5 min or over 365 days ahead, no tracks, a track without `durationSec` or `streamKey`. 404: unknown release. 403: not your release, or you have no channel. 409: overlaps another non-canceled party on your channel. |
| `GET /api/me/listening-parties` | `{ items: ListeningPartySummaryDto[] }`, all states, latest `startAt` first. |
| `PATCH /api/me/listening-parties/:id` | Body `{ startAt?, hostNote? }` → `ListeningPartyDto`. Only while `SCHEDULED` (409 otherwise). A new `startAt` gets the create window (400) and overlap (409) checks. |
| `POST /api/me/listening-parties/:id/cancel` | → `ListeningPartyDto`. Works while `SCHEDULED` or `LIVE`; already canceled returns it unchanged; 409 once `ENDED`. |

PATCH and cancel answer 404 for an unknown party and 403 for someone else's.
Overlap checks take a per-channel advisory lock so two concurrent requests
can't both pass.

Schemas: `packages/shared/src/dto/listening-party.ts`. Exact shapes are in
the generated OpenAPI under the `listening-parties` tag.

## Chat announcements

The `listening-party-announce` worker job (light lane, every 15 s) posts
`Now playing 3/10 · Title` as a system line (`system: true`, handle `Tahti`)
in the host channel's chat when a live party reaches a new track. `n` is the
track's place in the tracklist. Each track is announced at most once:
`ListeningParty.announcedPosition` is claimed with a conditional update
before publishing. A tick that misses a short track does not post it late,
and a failed publish is not retried. Channels with chat off get no lines.
System lines go straight to Centrifugo and are not stored as `ChatMessage`
rows, like the "loved" announcements.

## Code map

| Piece | Path |
| --- | --- |
| Model + migrations | `packages/db/prisma/schema.prisma` (`ListeningParty`), `migrations/20261028120000_listening_party`, `migrations/20261028130000_listening_party_announced_position` |
| Timeline + schemas | `packages/shared/src/listening-party-timeline.ts`, `packages/shared/src/dto/listening-party.ts` |
| DTO builders, overlap check | `apps/api/src/lib/listening-party.ts` |
| Routes | `apps/api/src/routes/listening-parties/{me,public}.ts` |
| Worker job | `apps/worker/src/jobs/listening-party-announce.ts` |
