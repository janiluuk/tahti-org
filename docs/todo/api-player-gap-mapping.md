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

---

## Remaining open

| Level | Item                                                               |
| ----- | ------------------------------------------------------------------ |
| P1    | Bandcamp albums + import route (real Bandcamp API v1)              |
| P2    | Full Discord cutover to always-on HLS (ops: set audio URL in prod) |
| P2    | Large god modules / further radio-plugin merge (player todos)      |
| P3    | Account-backed favorites/history; FORCE_MOCK demos                 |

When fully done: fold into `docs/todo/HISTORY.md` and delete.
