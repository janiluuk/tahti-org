# ListenBrainz scrobble (2026-09-04)

## Requested

Ship submit-listens scrobbling through the existing integrations credential
store (not a charts dashboard).

## Implementation

- Registry: `SCROBBLE` scope + `listenbrainz` API_KEY provider (`userToken`).
- Client: `apps/api/src/lib/listenbrainz.ts` (validate-token + submit-listens).
- Installer validates the token before encrypting `{ userToken }`.
- After `POST /api/listen-events` records successfully for a signed-in user,
  fire-and-forget scrobble when ListenBrainz is installed and title/artist
  are non-empty. Optional `recording_mbid` from linked `ReleaseTrack`.
- Docs: `scrobble-plugin-contracts.md`, credential lifecycle update.

## Naming

- `submission_client`: `tahti` (lowercase product name).
- Origin URL: `resolveChannelUrl(channel.slug, { hash: \`sound-item-${id}\` })`.
- Artist: `Sound.artistName` override, else channel owner `displayName`.
- Sound has no `musicbrainzRecordingId`; MBID comes from `ReleaseTrack` when present.
