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

- [ ] Run the backfill on production after deploy (dry run first).
- [ ] Worker-created sounds (SoundCloud / hearthis / Drive imports, broadcasts)
      rely on the backfill; hook them at create if they should get one immediately.
- [ ] Accounts created with a generated SVG avatar keep it (only empty avatars
      get a preset).
