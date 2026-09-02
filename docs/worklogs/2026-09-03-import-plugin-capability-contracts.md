# Import plugin capability contracts (2026-09-03)

## Requested

Expose OAuth, search, and link/tool adapter contracts from Tahti core so
Tahti Player / Nuclear can split Sources without a fake universal
start/status/import interface. Do not invent an `ExportProvider`
submit/status/webhook API.

## Implementation

- Extended `ImportPluginProvider` with optional `search`/`playback`
  capabilities, nullable `statusPath`, and optional `searchPath` /
  `listPath` / `importPath`.
- Expanded `GET /api/me/import-plugins` from Google Drive-only to the
  live import catalog: Bandcamp, SoundCloud, Mixcloud, Spotify search,
  hearthis.at, local upload, stash, URL paste, and internet radio.
- Documented the three-kind split and the blocked export contract in
  `docs/technical/import-plugin-contracts.md`.

## Not done (blocked)

DSP export submit/status/webhook routes still do not exist. Revelator
delivery remains the shared Studio distribution path. Do not add a
behavioral `ExportProvider` until those contracts land.
