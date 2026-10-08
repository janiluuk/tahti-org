# API ↔ Tahti Player gap mapping

**Status:** partial  
**Audited:** 2026-10-05  
**Repos:** this monorepo (`tahti-org` API) + sibling `../tahti-player` (+ CLI in
`../tahti-player/packages/tahti-cli`)

---

## Batch 1 (2026-10-05) — honesty / docs

| #    | Slice                                                   | Status                 |
| ---- | ------------------------------------------------------- | ---------------------- |
| 1–5  | Import/export registry honesty + Revelator webhook flag | done (PR #709)         |
| 6–7  | Jam PATCH / sound share                                 | already on main — docs |
| 8–10 | Player fail-closed export catalog + API-REFERENCE       | done (player #508)     |

## Batch 2 (2026-10-05) — sync + honesty UX

| #   | Slice                                                               | Status |
| --- | ------------------------------------------------------------------- | ------ |
| 11  | Revelator webhook → `Release.revelatorStatus` sync; `webhook: true` | done   |
| 12  | Revelator stub submit refuse in production                          | done   |
| 13  | Mixcloud stub upload refuse in production                           | done   |
| 14  | Bandcamp albums OpenAPI + `importAvailable: false` stub body        | done   |
| 15  | Configure lifecycle settled (host modal; Save ≠ Enable)             | done   |
| 16  | Android script `@tahti-player/player` filter                        | done   |
| 17  | Bandcamp catalog/UI honesty (no fake Import)                        | done   |
| 18  | Export DSP deep-link labels (“Open distribution”)                   | done   |
| 19  | Soulseek “Desktop only” (not Test connection)                       | done   |
| 20  | Settings “Not available yet” copy                                   | done   |

## Batch 3 (2026-10-05) — catalogs + Discord audio path

| #   | Slice                                                                              | Status |
| --- | ---------------------------------------------------------------------------------- | ------ |
| 21  | `mixcloud-embed` search provider in import registry (≠ Mixcloud OAuth)             | done   |
| 22  | hearthis-export ExportProvider sound alias `/export-plugins/.../sounds/:id/submit` | done   |
| 23  | Discord playback docs: HLS / `TAHTI_RADIO_AUDIO_URL`, not `GET /api/v1/radio`      | done   |
| 24  | Compose `radio-discord-bot` gets `TAHTI_RADIO_AUDIO_URL`                           | done   |
| 25  | Discord bot optional HLS playlist (sibling repo)                                   | done   |
| 26  | Player `mixcloud-embed` search adapter + catalog honesty (radio/mixcloud flags)    | done   |
| 27  | Radio help catalog disambiguation (stations vs paste-URL)                          | done   |
| 28  | PluginLoader `@nuclearplayer` aliases documented as intentional compat             | done   |
| 29  | tahti-cli README notes import/export plugin catalogs                               | done   |
| 30  | Gap ledger + INDEX refresh                                                         | done   |

## Batch 4 (2026-10-06) — honesty residuals + docs/OpenAPI

| #   | Slice                                                                    | Status |
| --- | ------------------------------------------------------------------------ | ------ |
| 31  | Bandcamp `fileList: false` / `listPath: null` residual                   | done   |
| 32  | Fail-closed `fetchUserMedia` mock catch (`withMockFallback`)             | done   |
| 33  | Player `check:api-docs` hash regen (follow-up after OpenAPI export)      | done   |
| 34  | OpenAPI swagger tag catalog expanded for used route tags                 | done   |
| 35  | Studio Distribution stub-mode banner + `GET /api/me/distribution/status` | done   |
| 36  | Sound-share keyed access → `SOUND_SHARE_ACCESS` audit log                | done   |
| 37  | `remaining-work` Discord/Revelator/hearthis rows aligned to code         | done   |
| 38  | Drop “Nuclear clients” wording in shared import/export contracts         | done   |
| 39  | Plugin vocabulary cheat-sheet in import/export contracts                 | done   |
| 40  | Discord prod HLS cutover checklist (ops; not `/api/v1/radio`)            | done   |

## Batch 5 (2026-10-08) — route diff: theme catalog, admin files, drift guard

Found by diffing every `/api/...` path in `tahti-web/src` against the route
table, in both directions.

| #   | Slice                                                                                                                 | Status |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------ |
| 41  | Approved themes open their pull request in `tahti-registry` (schema-valid `themes/<slug>.json`), not in this repo     | done   |
| 42  | `GET /api/v1/themes/gallery` reads the `tahti-registry` `themes.json` catalog (was a file that never existed → `[]`)  | done   |
| 43  | `POST /api/admin/files/bulk-delete` (per-item result, one audit row)                                                  | done   |
| 44  | `GET/PATCH /api/me/musicbrainz/default` in OpenAPI; PATCH without a body answers 400 instead of 500                   | done   |
| 45  | Player: Admin → Storage bulk delete with confirmation; a failed single delete is now shown                            | done   |
| 46  | Player: Admin → Languages says "Not available yet" on a 404 (the API has no `/api/admin/i18n/*`) instead of mock rows | done   |
| 47  | Player: `pnpm check:api-routes` fails on a called path the API does not serve; `TAHTI_OPENAPI` override               | done   |
| 48  | Player: API reference rows for the new routes + `API_PATHS_SHA256` regenerated                                        | done   |
| 49  | Docs: theme catalog source in `docs/api/README.md`, shared DTO comment and the worker's token note                    | done   |
| 50  | Gap ledger + INDEX refresh; player `GAP-MAPPING.md` rows                                                              | done   |

Notes for whoever picks this up:

- Slice 41 needs `GITHUB_PR_TOKEN` on the worker with `contents:write` and
  `pull_requests:write` on **`janiluuk/tahti-registry`**. The token is still not
  provisioned anywhere, so no theme pull request has ever been opened.
- The registry's "Build Theme Index" workflow regenerates `themes.json` after a
  merge; the worker only adds the theme file.
- `defaultRegisterToMusicbrainz` (slice 44) is stored and returned but no client
  reads it yet.

---

## Remaining open

| Level | Item                                                                                                            |
| ----- | --------------------------------------------------------------------------------------------------------------- |
| P1    | Bandcamp albums + import route (real Bandcamp API v1 — needs keys)                                              |
| P2    | Full Discord cutover: set `TAHTI_RADIO_AUDIO_URL` in **prod** ops                                               |
| P2    | Large god modules / further radio-plugin merge (player todos)                                                   |
| P3    | Account-backed favorites/history; FORCE_MOCK demos                                                              |
| P3    | Admin translation management (`/api/admin/i18n/*`) — no API; decide whether to build it or drop the player page |
| P3    | Provision `GITHUB_PR_TOKEN` for `tahti-registry` so approved themes actually open a pull request (ops)          |

When fully done: fold into `docs/todo/HISTORY.md` and delete.
