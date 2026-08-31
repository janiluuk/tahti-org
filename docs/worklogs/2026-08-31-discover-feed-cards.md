# Discover Your feed cards (2026-08-31)

## Requested

Under Discover, show “Your feed” as a horizontal list of large thumbnail cards,
with play and queue actions like the other listening surfaces.

## Implementation

- Added playable `audioUrl` data to followed-artist track feed items.
- Added a Discover-only horizontal card layout with large artwork, artist/date
  context, and play/queue controls for playable tracks.
- Kept the existing vertical feed layout for the standalone `/feed` page and
  dashboard embedding.
- Feed post cards now include attached post images, with additional images
  shown as thumbnails beneath the lead artwork.
- Feed entries link to their content and use humanized relative dates such as
  “3h ago” and “2d ago”.
- Hearthis archive items in the dashboard archive and collection editor now
  use the shared player, queue, and expanded hearthis widget lifecycle.

## Follow-up

- Removed the release-page flag action.
- Release track titles now open the standalone full-waveform track player at
  `/tracks/:id`; the release page keeps play and queue controls alongside them.
- Artist channel headers now place the profile link in the upper-right and give
  social links their own aligned “Find the artist elsewhere” section.
- Artist channel pages now show the bio below the banner, with latest releases
  placed below the live player; the archive is labeled “Sounds.”
- Google Drive import job creation now writes a `CONTENT_UPLOAD` audit event with
  the job ID, source, external file ID, and filename.

## Follow-up workplan: port the plugin system to core

### Boundary

- Tahti core owns API routes, OAuth handling, encrypted credentials, import
  jobs, audit logs, and persistence.
- Nuclear, in `../tahti-nuclear`, owns the plugin UI and configuration modal.
- Import configuration must happen through the plugin Configure action: enter
  settings, test the connection, save, then enable.
- Do not add a parallel configuration surface in Tahti core.

### Open decisions

- Decide between a host-rendered configuration modal and a first-class SDK
  configuration lifecycle hook.
- Define the standard connection-test response and error states.
- Decide whether Save and Enable are atomic or separate actions.
- Decide whether provider secrets live only server-side or are temporarily
  mirrored in Nuclear settings.

### Implementation sequence

1. Audit the existing Nuclear plugin SDK, Configure action, settings system,
   Tahti source registry, OAuth flows, import workers, and audit paths.
2. Define a versioned provider contract with capabilities for configuration,
   connection testing, file listing, and import-job creation.
3. Keep provider types separate: OAuth, file import, search, and tool sources
   should not be forced into one universal interface.
4. Add Tahti-side provider adapters, generic configuration/status endpoints,
   encrypted credential handling, import-job creation, and audit logging.
5. Add Nuclear’s plugin-scoped Configure modal with connection testing,
   validation, Save, Enable, Disable, and Disconnect states.
6. Port Google Drive first as the reference plugin while preserving the
   existing integration through a compatibility adapter.
7. Port SoundCloud and hearthis only after the Google Drive path is stable.

### Quality and rollout gates

- Test provider contracts, OAuth/token handling, import jobs, audit events, and
  worker retries in Tahti.
- Test Configure modal behavior, connection failures, Save/Enable flow, and
  plugin lifecycle in Nuclear.
- Deploy Tahti core before publishing the compatible Nuclear plugin.
- Verify the complete Google Drive journey in staging before removing legacy
  paths.

## STREAM-011 B spike findings

- Current Liquidsoap `v2.2.5` channel and rotation templates emit two HLS
  variants (`stream-mp3-192` and `stream-flac`) using MPEG-TS segments on the
  shared HLS volume.
- The current live path and player still resolve a single leaf manifest; a
  multi-bitrate implementation needs a master playlist and corresponding
  `liveHlsManifestPath()` changes.
- FLAC-in-MPEG-TS is not a viable browser path. The next experiment must test
  Liquidsoap fMP4/CMAF output with a browser, including hls.js and Safari-native
  playback, before changing the production template.
- If browser-compatible lossless HLS fails, the fallback scope is a high-bitrate
  AAC/MP3 rendition with per-listener ABR.
- No production streaming behavior was changed during this spike.

### Acceptance criteria before implementation

1. Confirm the generated master playlist and variant codec/container metadata.
2. Play every candidate rendition in hls.js and Safari-native HLS.
3. Verify automatic downgrade under constrained throughput.
4. Verify MinIO sync, Caddy serving, watchdog freshness, and archive fallback.
5. Add an operator-only emergency flag for 192k-only output only if the test
   proves it is needed beyond normal per-listener ABR.

## Plugin-system audit follow-up (2026-08-31)

- Nuclear has an installable-plugin lifecycle (`onLoad`/`onEnable`/
  `onDisable`) and namespaced persisted settings, but Tahti imports currently
  live in a separate hard-coded `SOURCE_DEFS` registry and source-specific API
  clients.
- Nuclear already follows the required configuration rule for these sources:
  the Configure gear opens an inline modal, where connection state is checked
  and the user can connect/configure or disconnect; there is no separate
  per-source settings page to preserve.
- Tahti's Google Drive path already provides OAuth start/callback, encrypted
  access and refresh tokens, picker configuration, queued cloud-import jobs,
  worker processing, job status, and `CONTENT_UPLOAD` audit events. The first
  core-porting change should therefore define a versioned provider/capability
  contract around those existing boundaries, then adapt Google Drive to it;
  duplicating the OAuth or configuration UI would violate the agreed boundary.
