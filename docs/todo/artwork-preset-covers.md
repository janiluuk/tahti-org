# Artwork preset covers

**Status:** partial

Board-managed `ArtworkPreset` rows (seeded with the web app's sixteen
`/artwork-presets/artwork-NN.webp` covers, resolved against `PUBLIC_WEB_URL`).
Enabled presets are saved as the cover of new sounds (upload and API
imports), collections and provisioned channels' owner avatars when they have
none, and are listed publicly for the cover picker.

- Admin: `GET/POST /api/admin/artwork-presets`, `PATCH/DELETE /:id` (board).
- Public: `GET /api/v1/artwork-presets` (enabled only, 60 s cache).
- Backfill: `apps/api/scripts/backfill-preset-covers.ts [--dry-run]`.

Left:

- [ ] Run the backfill on production after deploy (dry run first). 2026-11-02:
      the dry run on vimage reports 22 sounds, 1 collection and 3 channel avatars
      to fill; the real run needs the operator.
- [x] Worker-created sounds (SoundCloud / hearthis / Drive imports, broadcasts)
      get a preset at create (#1041; helpers moved to `@tahti/db`).
- [ ] Accounts created with a generated SVG avatar keep it (only empty avatars
      get a preset).
