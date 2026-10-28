# Listening parties

An artist schedules a one-time play of one of their releases. At `startAt`
the release plays once, start to finish, in track order; fans on the party
page hear the same track at the same point, read the liner notes, talk in the
host channel's chat and can buy from the artist's purchase tiers.

Digital-only v1. Formats, pre-orders and physical goods are a separate
project.

## Decisions

| Decision | Why |
| --- | --- |
| Own `ListeningParty` model (schema `channel`), not `ScheduledLiveShow` + `releaseId` | A scheduled show needs a `LiveShowSeries`; a party belongs to a release. |
| No server playout. The server owns the timeline, clients play the tracks themselves and seek to the offset | Shared timing and late join without a Liquidsoap container per party. Playout into the channel's HLS is a later project. |
| State is derived, never stored | `canceledAt` → `CANCELED`; `now < startAt` → `SCHEDULED`; `now < startAt + Σ durationSec` → `LIVE`; else `ENDED`. Nothing can go stale when a track is re-timed. |
| Tracks play once in `ReleaseTrack.position` order, no gaps | Intervals are half-open: at an exact boundary the next track plays at offset 0; at `endAt` the party has ended. |
| Pre-release tracks stream only through the party | A release that is not `PUBLISHED`, or whose `releaseDate` is ahead, streams only from the party stream route, only while `LIVE`, and only for the current or an earlier track. |
| Reuse the artist's `PurchaseTier`s | Active tiers, only while the channel's store is on and (with Stripe on) the artist can take charges. Checkout stays on `POST /api/v1/u/:username/purchase-tiers/:tierId/checkout`. |
| Reuse the host channel's chat | Moderation, bans and announcements already exist there. |
| Names via `safeDisplayName` | Host and channel names fall back to the username. Credits whose name contains an email address are dropped. |

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
