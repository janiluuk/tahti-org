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

## Batch 5 (2026-10-08) — OAuth import routes: OpenAPI + `configured` honesty

| #   | Slice                                                                                      | Status |
| --- | ------------------------------------------------------------------------------------------ | ------ |
| 41  | Bandcamp status + disconnect in OpenAPI; shared `ImportOAuthConnectStatus` body            | done   |
| 42  | SoundCloud status + disconnect in OpenAPI                                                  | done   |
| 43  | SoundCloud track list (`listPath`) response schema `SoundcloudTrackList`                   | done   |
| 44  | OAuth start routes documented as 302 (Bandcamp, SoundCloud, Google Drive, Mixcloud)        | done   |
| 45  | OAuth callback routes documented with their `?bc=` / `?sc=` / `?gd=` / `?mixcloud=` result | done   |
| 46  | `configured` needs client id **and** secret; status, connect (503) and disconnect agree    | done   |
| 47  | Bandcamp albums + SoundCloud import moved to the `imports` tag; cover proxies documented   | done   |
| 48  | Email bounce webhook documented under `webhooks`                                           | done   |
| 49  | Guard test: every path in the import/export catalogs is a registered, documented route     | done   |
| 50  | Contracts doc + ledger + INDEX refresh                                                     | done   |

## Batch 6 (2026-10-08) — MusicBrainz parity, provider error codes, player honours them

| #   | Slice                                                                                         | Status             |
| --- | --------------------------------------------------------------------------------------------- | ------------------ |
| 51  | MusicBrainz status + disconnect in OpenAPI (`MusicbrainzConnectStatus`)                       | done               |
| 52  | MusicBrainz connect, both callback paths and the remembered default documented                | done               |
| 53  | MusicBrainz `configured` needs client id **and** secret; connect answers 503 otherwise        | done               |
| 54  | MusicBrainz callback takes the account from `request.sessionUser` like the other providers    | done               |
| 55  | `PROVIDER_NOT_CONNECTED` / `PROVIDER_TOKEN_EXPIRED` codes on SoundCloud, Bandcamp and Drive   | done               |
| 56  | Player: expired or missing SoundCloud link falls back to Connect, not an empty track list     | done (player #562) |
| 57  | Player: service card does not send the artist to a provider the server has not set up         | done (player #562) |
| 58  | Player: Import sources dialog disables Connect when not set up; failed status ≠ "needs setup" | done (player #562) |
| 59  | Player `API-REFERENCE` hash regen + OAuth provider section                                    | done (player #562) |
| 60  | Contracts doc + ledger + INDEX refresh                                                        | done               |

## Batch 7 (2026-10-08) — OpenAPI honesty for remaining import/export routes

| #   | Slice                                                                                         | Status |
| --- | --------------------------------------------------------------------------------------------- | ------ |
| 61  | Google Drive status / picker / import / jobs retagged to `imports`                            | done   |
| 62  | Drive + SoundCloud queued import documented as 202                                            | done   |
| 63  | Canonical hearthis-export (`POST /api/me/sound/:id/export/hearthis`) documented as 202        | done   |
| 64  | Spotify profile status / link / unlink tagged `imports`                                       | done   |
| 65  | Stash list + `POST /api/uploads/prepare` tagged `imports`                                     | done   |
| 66  | Search/add summaries; Spotify / Mixcloud / hearthis add documented as 201                     | done   |
| 67  | SoundCloud desktop download unhidden in OpenAPI as 302                                        | done   |
| 68  | SoundCloud playlists / tracks / resolve summaries                                             | done   |
| 69  | Reverse capability flags (path set iff matching import/search/fileList or export flag)        | done   |
| 70  | Contracts doc + ledger + INDEX refresh                                                        | done   |

## Batch 8 (2026-10-08) — catalog tags, Mixcloud/Revelator/integrations OpenAPI

| #   | Slice                                                                                      | Status |
| --- | ------------------------------------------------------------------------------------------ | ------ |
| 71  | `GET /api/me/import-plugins` tagged `imports`                                              | done   |
| 72  | `GET /api/me/export-plugins` tagged `releases`                                             | done   |
| 73  | Mixcloud OAuth status / start / callback / disconnect tagged `imports`                     | done   |
| 74  | Mixcloud disconnect + upload + upload-status summaries                                     | done   |
| 75  | Mixcloud upload 403 carries `PROVIDER_NOT_CONNECTED`                                       | done   |
| 76  | Canonical Revelator status / submit / billing summaries                                    | done   |
| 77  | ExportProvider alias summaries                                                             | done   |
| 78  | Spotify profile unlink documented as 204 (`openApiNoContentResponse`)                      | done   |
| 79  | Integrations list / install / uninstall in OpenAPI (204)                                   | done   |
| 80  | Contracts + ledger + INDEX refresh                                                         | done   |

---

## Remaining open

| Level | Item                                                               |
| ----- | ------------------------------------------------------------------ |
| P1    | Bandcamp albums + import route (real Bandcamp API v1 — needs keys) |
| P2    | Full Discord cutover: set `TAHTI_RADIO_AUDIO_URL` in **prod** ops  |
| P2    | Large god modules / further radio-plugin merge (player todos)      |
| P3    | Account-backed favorites/history; FORCE_MOCK demos                 |

When fully done: fold into `docs/todo/HISTORY.md` and delete.
