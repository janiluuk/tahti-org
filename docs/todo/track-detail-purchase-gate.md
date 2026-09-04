# Track detail purchase gate (player contract)

**Status:** done 2026-09-04.

Tahti Player's track listen page expects `GET /api/tracks/:id` to carry
one-time purchase fields and to withhold `audioUrl` when the viewer is not
entitled. The route previously always signed a stream URL for any public
READY item.

## Shipped

- `PublicTrackDetailSchema`: `accessMode`, `purchaseTierId` / name / price,
  nullable `gate`.
- `GET /api/tracks/:id`: resolve `resolvePlaybackGateStatus` for the session
  user; null `audioUrl` + set `gate` when blocked; always return tier labels
  for the buy CTA.
- `GET /api/v1/c/:slug/archive/:itemId/download`: same playback gate before
  repost/follow gates.
- Docs: `docs/api/README.md` purchase-tiers family + track/download notes +
  artist news feed.
