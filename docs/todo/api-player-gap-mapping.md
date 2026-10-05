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

---

## Remaining open

| Level | Item                                                                  |
| ----- | --------------------------------------------------------------------- |
| P1    | Bandcamp albums + import route (real Bandcamp API v1)                 |
| P1    | Discord bot playback source → Tahti Radio API                         |
| P2    | `@nuclearplayer` PluginLoader / UMD compat aliases (keep for plugins) |
| P2    | Large god modules / duplicate radio plugins (player todos)            |
| P3    | Account-backed favorites/history; FORCE_MOCK demos                    |

When fully done: fold into `docs/todo/HISTORY.md` and delete.
