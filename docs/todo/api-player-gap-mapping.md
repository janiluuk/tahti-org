# API ↔ Tahti Player gap mapping

**Status:** partial (10 honesty/wiring slices in flight)  
**Audited:** 2026-10-05  
**Repos:** this monorepo (`tahti-org` API) + sibling `../tahti-player` (+ CLI in
`../tahti-player/packages/tahti-cli`)  
**Related:** player `packages/tahti-web/GAP-MAPPING.md`,  
`docs/technical/tahti-player-integration.md`,  
`docs/technical/import-plugin-contracts.md`,  
`docs/technical/export-plugin-contracts.md`

---

## Slices in this PR batch (2026-10-05)

| #   | Slice                                                                | Status                                                    |
| --- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | Bandcamp registry honesty (`import: false`, null phantom importPath) | done                                                      |
| 2   | Google Drive `importPath` → `/api/me/google-drive/import`            | done                                                      |
| 3   | hearthis-export registry → live sound submit path                    | done                                                      |
| 4   | upload/radio/mixcloud capability honesty                             | done                                                      |
| 5   | Revelator `webhook: false` until status sync; path kept              | done                                                      |
| 6   | Jam participant PATCH                                                | **already on main** (# earlier) — doc correction          |
| 7   | Sound private-share API                                              | **already on main** (#568) — player API-REFERENCE updated |
| 8   | Player `fetchExportPlugins` fail-closed                              | done                                                      |
| 9   | Docs: integration.md, AGENTS registry, export contracts, this ledger | done                                                      |
| 10  | OpenAPI schema on hearthis sound-export + API-REFERENCE refresh      | done                                                      |

---

## Remaining open (not in this batch)

| Level | Item                                                                           |
| ----- | ------------------------------------------------------------------------------ |
| P1    | Revelator webhook **status sync** implementation (flag stays false until then) |
| P1    | Bandcamp albums stub → real Bandcamp API v1 + import route                     |
| P1    | Configure lifecycle decision (SDK hook vs host modal)                          |
| P1    | Discord bot playback source → Tahti Radio API                                  |
| P2    | `@nuclearplayer` naming leftovers in player scripts / PluginLoader             |
| P2    | Large god modules / duplicate radio plugins (player todos)                     |
| P3    | Deep-link DSP storefront rows, FORCE_MOCK demos, local favorites               |

Corrected vs original audit: sound-share and jam PATCH were already shipped;
player docs still called them “proposed”.

---

## Severity legend

| Level | Meaning                                                   |
| ----- | --------------------------------------------------------- |
| P0    | Broken or lying contract                                  |
| P1    | Stub / unwired while UI or registry advertises capability |
| P2    | Docs/OpenAPI/naming/structure debt                        |
| P3    | Intentional deferrals                                     |

When the remaining rows ship or this file is fully done: fold into
`docs/todo/HISTORY.md` and delete (catalog fold only when the PR is ready).
