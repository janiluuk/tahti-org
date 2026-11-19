# Go live redesign: API side

**Status:** partial

**Why:** The Tahti Player "Go live" redesign (`../tahti-player` Go live stepper,
Decisions 2026-11-10) needs show info saveable before the encoder connects, a
`PRIVATE` visibility for test runs, a per-broadcast cover, and an explicit
reconnecting state instead of the client guessing from "LIVE without signal".

## Shipped

- **Pre-session draft:** `channel.BroadcastShowDraft` (one row per channel).
  `GET/PATCH /api/me/channel/preflight` read/write it while there is no
  PREVIEW/LIVE session (`session: 'NONE'`); the ingest connect hook applies it
  to the new broadcast (draft fields win over series / planned-show defaults)
  and deletes it. A 24/7 fallback placeholder counts as "no session".
- **LIVE lock:** while LIVE, changing `showType`, `visibility` or `seriesId`
  returns 409. Sending the current value is accepted (autosave-friendly).
- **PRIVATE:** new `BroadcastVisibility` value. Hidden for everyone but the
  owner on the public channel payload, `/api/v1/channels` live list, artist
  directory, addon context, channel embed, live fingerprints, radio show
  now-playing; never relayed onto Tahti Radio or featured; no follower
  notification or social post on go-live; recording never auto-published;
  multistream mirrors dropped while the session is open (orchestrator).
  Series and scheduled shows stay `PUBLIC | FAN_ONLY`.
- **Cover:** `artworkUrl` in the draft / PATCH, must be the caller's own
  `POST /api/me/media/prepare` + `/complete` upload. Responses add `coverUrl`
  (`artworkUrl ?? avatarUrl`); Tahti Radio past episodes use the same fallback.
- **Reconnecting:** an encoder drop on a LIVE show sets
  `Broadcast.ingestDisconnectedAt` and keeps the show open for
  `BROADCAST_RECONNECT_GRACE_MS` (2 min). Same-protocol reconnect in time
  resumes it; otherwise the `broadcast-reconnect-expiry` light-minute task ends
  it at the drop time and queues the recording. Exposed as `ingest` +
  `reconnectDeadline` on `GET /api/me/stream-settings/status` and
  `GET /api/auth/me` `channel`.
- **Player (tahti-player):** Go live uses `session`, `coverUrl`, `ingest`, and
  `reconnectDeadline` (`useGoLiveState` / status chip / show info). Checkbox
  closed 2026-11-19.
- **Recorder on reconnect (2026-11-19):** `spawnBroadcastRecorder` (and
  fingerprint ingest) respawn when the previous sidecar for the same broadcast
  id has exited, so audio after a LIVE reconnect is recorded again.
- **alwaysMirror after PRIVATE (2026-11-19):** RTMP/Icecast end paths restart
  Liquidsoap after a PRIVATE session ends so 24/7 mirror targets return.

## Left

- [ ] HLS is served from MinIO without auth, so a PRIVATE (like a PREVIEW)
      stream is hidden by not handing out its URL, not by access control.
      Recorded in `docs/DECISIONS.md` (2026-11-19).
