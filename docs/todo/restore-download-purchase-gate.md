# Restore purchase/subscriber gate on sound downloads

PR #434 gated `GET /api/v1/c/:slug/archive/:itemId/download` with
`resolvePlaybackGateStatus`. The Archive→Sound rename (#427) dropped that
check from `apps/api/src/routes/downloads/sound.ts`, so paywalled and
subscriber-only tracks could be downloaded (including `format=source`)
without purchase or subscription.

## Status

Fix restored on the download routes; tests in
`apps/api/src/routes/downloads/sound-purchase-gate.test.ts`.

## Leftovers (not in this PR)

Public list/play paths still presign `audioUrl` without the same gate:
`GET /api/channels/:slug/items`, discover latest-tracks, collection pages,
and embed play. Those are streaming bypasses, not source-file downloads.
