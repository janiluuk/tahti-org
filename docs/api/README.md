# Tahti API

This is the human-maintained map of the Tahti API. The generated OpenAPI
document is the contract for exact parameters, response schemas, and examples.

- Public reference UI: [`https://api.tahti.live/`](https://api.tahti.live/)
- Public OpenAPI: `GET https://api.tahti.live/api/openapi.json`
- Local API: `http://localhost:3001`
- Full operations reference: `GET /docs` (HTTP basic auth)
- Generated TypeScript client: [`packages/api-client`](../../packages/api-client/)

## Conventions

Production base URL: `https://api.tahti.live`. Public endpoints are normally
available without an account. Artist, member, and board operations use the
`tahti_session` cookie created by the auth routes. JSON errors use the status
code and response shape documented in OpenAPI; clients should not rely on error
message text.

The public OpenAPI excludes `/api/admin/*`, internal routes, metrics, and the
authenticated operations reference. Do not publish session cookies, API
tokens, stream keys, or signed upload URLs in logs or client telemetry.

## Topic map

### Health, release, and discovery

| Purpose                        | Endpoints                                                         |
| ------------------------------ | ----------------------------------------------------------------- |
| API release                    | `GET /api/version`                                                |
| Service health                 | `GET /api/v1/status`                                              |
| Browse live/replaying channels | `GET /api/v1/channels`, `GET /api/v1/channels/directory`          |
| Search                         | `GET /api/v1/search`, `GET /api/v1/search/tracks`                 |
| Latest/new discovery           | `GET /api/discover/latest-tracks`, `GET /api/discover/new-to-you` |
| Top lists                      | `GET /api/top-lists`, `GET /api/top-lists/ranks`                  |
| Platform/news                  | `GET /api/v1/stats`, `GET /api/v1/news`                           |
| Latest release feed            | `GET /api/releases/latest`                                        |

### Listening, channels, and radio

| Purpose                            | Endpoints                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Channel and now-playing data       | `GET /api/channels/:slug`, `GET /api/channels/:slug/presence`                                                                                                       |
| Channel archive                    | `GET /api/channels/:slug/items`                                                                                                                                     |
| Channel archive downloads          | `GET /api/v1/c/:slug/archive/:itemId/download`                                                                                                                      |
| Tahti Radio now playing            | `GET /api/v1/radio`                                                                                                                                                 |
| Radio history, schedule, and slots | `GET /api/v1/radio/history`, `GET /api/v1/radio/recently-played`, `GET /api/v1/radio/rotation`, `GET /api/v1/radio/slots`                                           |
| Internet-radio presets             | `GET /api/v1/internet-radio/presets/enabled` (public); `GET /api/internet-radio/presets` (artist, requires auth — do not confuse the two, paths are easy to mix up) |
| Live chat                          | `POST /api/chat/message`, `GET /api/chat/:slug/{access,history,token,viewer-token,announcements}`, `POST /api/chat/:slug/react`                                     |
| Addons                             | `GET /api/v1/channels/:slug/addons`, `GET /api/v1/addons/{homepage,discover,bundle/:bundleHash}`, `GET /api/addons/store`                                           |
| Theme gallery                      | `GET /api/v1/themes/gallery`                                                                                                                                        |
| Embeds                             | `GET /api/v1/embed/c/:slug` (channel), `GET /api/v1/embed/r/:id` (release), `GET /api/v1/embed/col/:slug` (collection) — each has its own play-tracking sub-routes  |

### Artists, profiles, catalog, and collections

| Purpose                       | Endpoints                                                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Public artist profile         | `GET /api/v1/u/:username/profile`                                                                                                  |
| Artist mentions and fan tiers | `GET /api/v1/u/:username/mentions`, `GET /api/v1/u/:username/tiers`                                                                |
| Fan subscription checkout     | `POST /api/v1/u/:username/subscribe`, `GET /api/v1/fansubs/portal`                                                                 |
| Collections and feeds         | `GET /api/v1/collections/:slug`, `GET /api/v1/collections/:slug/rss.xml`, `GET /api/v1/u/:username/rss.xml`                        |
| Collection subscribe          | `POST /api/v1/collections/:slug/subscribe`                                                                                         |
| Smart links                   | `GET /api/v1/r/:slug`, click tracking via `POST /api/smartlink/click`                                                              |
| Public releases/tracks        | `GET /api/v1/releases/:id`, `GET /api/v1/tracks/:id`, downloads via `GET /api/v1/releases/:smartLinkSlug/tracks/:trackId/download` |

### Venues, collab, and other public features

| Purpose                      | Endpoints                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Venue directory and calendar | `GET /api/v1/venues`, `GET /api/v1/venues/:slug`, `GET /api/v1/venues/:slug/broadcasts`, `GET /api/v1/venues/:slug/calendar.ics`                                         |
| TahtiJam (synced listening)  | `POST /api/v1/jam`, `POST /api/v1/jam/:code/join`, `GET /api/v1/jam/:id`, `GET /api/v1/jam/:id/events` (SSE), `POST /api/v1/jam/:id/state`, `POST /api/v1/jam/:id/leave` |
| Support contact form         | `POST /api/support/contact`                                                                                                                                              |
| Newsletter public subscribe  | `POST /api/newsletter/subscribe`, `GET /api/newsletter/confirm/:token`, `GET /api/newsletter/unsubscribe/:token`                                                         |
| MCP (Model Context Protocol) | `/api/v1/mcp`                                                                                                                                                            |

### Engagement and community

| Purpose            | Endpoints                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Artist follows     | `POST`/`DELETE`/`GET /api/v1/artists/:username/follow` (note: singular `follow`, not `followers` — the endpoint returns the resulting `followerCount`) |
| Track likes        | `POST /api/v1/c/:slug/archive/:itemId/like`                                                                                                            |
| Reposts            | `POST /api/v1/c/:slug/archive/:itemId/repost`, `POST /api/v1/c/:slug/archive/:itemId/repost-ack`                                                       |
| Comments           | `GET/POST /api/comments/track/:id`, `GET/POST /api/comments/channel/:slug`, `DELETE /api/comments/:id`                                                 |
| Track reactions    | `GET/POST /api/reactions/track/:id`                                                                                                                    |
| Listen measurement | `POST /api/listen-events`, `POST /api/v1/listen/heartbeat`                                                                                             |
| Abuse reports      | `POST /api/v1/reports`                                                                                                                                 |

### Governance and transparency

| Purpose             | Endpoints                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Members and motions | `GET /api/v1/governance/members`, `GET /api/v1/governance/motions`                                                 |
| Motion actions      | `POST /api/v1/governance/motions`, `POST /api/v1/governance/motions/:id/vote`                                      |
| Motion discussion   | `GET/POST /api/v1/governance/motions/:id/comments`                                                                 |
| Public transparency | `GET /api/v1/transparency/ytd`, `GET /api/v1/transparency/monthly_rollup`, `GET /api/v1/transparency/grants/:year` |
| Public resolutions  | `GET /api/v1/transparency/resolutions`, `GET /api/v1/transparency/motions`                                         |

### Authentication and member/artist studio

| Purpose                                     | Endpoint family                                                                                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in/session                             | `/api/auth/*`                                                                                                                                        |
| Current member                              | `/api/me/*`                                                                                                                                          |
| Artist channel/broadcast                    | `/api/me/channel/*` (see below), `/api/me/stream-settings/*`                                                                                         |
| Releases, collections, and uploads          | `/api/me/releases`, `/api/me/collections`, `/api/uploads/*`                                                                                          |
| Comments, fan subscriptions, and newsletter | `/api/me/comments/*`, `/api/me/fan-tiers`, `/api/me/newsletter/*`                                                                                    |
| Catalog imports                             | `/api/v1/imports/{hearthis,mixcloud,spotify}/*` (`requireAuth`; note this family lives outside the `/api/me/*` prefix the rest of this section uses) |

These families contain authenticated mutations. Consult the generated
OpenAPI operation before calling them because permissions and required fields
vary by resource state.

**`/api/me/channel/*` is a large, unenumerated family** — roughly 20 route
files live under `apps/api/src/routes/me/` and `apps/api/src/routes/channels/`
covering visual/branding, backdrop, egress, funnel/live stats, members,
provisioning, schedule (+ show series, live-show episodes), slug, custom
domain, addon installs, go-live/end-broadcast, green room (+
defaults), moderators, meta-stream, programme, publish settings, recording
settings, gallery/slideshow, the channel text layer, stream overlay, and
preflight. The two most relevant to client channel-design work:

- `GET`/`PATCH /api/me/channel/visual` — `ChannelVisualPatchSchema`
  (`packages/shared/src/dto/visual-preset.ts`): `visualPreset`, `colorScheme`
  (`{bg,accent,text,muted,highlight}` hex), `visualSettings`, `headerStyle`
  (`GRADIENT`/`SOLID`/`VIDEO_LOOP`, `VIDEO_LOOP` requires a paid tier),
  `videoBackgroundUrl`, `brandAccentPreset` (also returned on the _public_
  `GET /api/channels/:slug`), `slideshowPreset`/`slideshowIntervalSeconds`/
  `slideshowTransitionMs`/`slideshowAutoplay`, `topBarText`.
- `GET`/`PATCH /api/me/channel/text-layer` — a stylized headline on the
  public channel page (`textLayerMode`/`textLayerText`/`textLayerAlign`,
  `packages/shared/src/dto/channel-text-layer.ts`), also returned on the
  public `GET /api/channels/:slug`. Collections have the same concept via
  `PATCH /api/me/collections/:slug/text-layer`
  (`packages/shared/src/dto/collection-theme.ts`).

**Not real backend concepts today** (checked while auditing a client that had
started building against them): there is no `channelLinks` field or
`/api/me/channel/links` route — arbitrary label+url links are not a Channel
model concept. There is no "player" headline/overlay distinct from the
channel text layer above; the only overlay-shaped field near "player" is
`GET`/`PATCH /api/me/channel/stream-overlay`
(`streamOverlayTitle`/`Subtitle`/`CoverUrl`/`BackdropUrl`/`VisualPreset`),
which is baked into the RTMP mirror video track pushed to multistream
targets (YouTube/Twitch) — not an in-app player UI overlay. A client wanting
either concept should either use `channel/text-layer` (it already does what
"player overlay" would) or file it under Priority backlog rather than
inventing a client-only field with no server column.

### Operations and administration

Board/admin and internal routes are intentionally not in the public document.
They are grouped in the full `/docs` reference and in the source by topic:

- `apps/api/src/routes/admin/` — users, content, grants, finance, radio,
  governance records, system logs, and moderation.
- `apps/api/src/routes/internal/` — ingest, stream control, radio handoff,
  service callbacks, and certificate checks.
- `apps/api/src/routes/releases/` and `uploads/` — media processing and
  delivery flows. (`downloads/` is **public**, not admin/internal-only — see
  "Channel archive downloads" and "Public releases/tracks" above; it was
  miscategorized here previously.)

| Purpose                                           | Endpoints                                      | Notes                                           |
| ------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| Tahti Radio Discord bot credentials (board)       | `GET`/`PUT /api/admin/discord-bot`             | Session + board. Never returns the raw token.   |
| Tahti Radio Discord bot credentials (bot process) | `GET /api/v1/internal/discord-bot/credentials` | Bearer `INTERNAL_SECRET` only; plaintext token. |

Full contract: [`docs/technical/discord-bot-credentials.md`](../technical/discord-bot-credentials.md).

## Change process

When adding or changing an endpoint:

1. Add or update its Fastify schema and route test.
2. Add a contract assertion for stable public JSON in
   `apps/api/src/routes/contracts/public-v1.test.ts` when applicable.
3. Regenerate the API client/OpenAPI artifacts with the repository scripts.
4. Update the relevant topic above and the release notes/worklog.
5. Run `pnpm ci:check` and the focused API tests.

The generated OpenAPI output remains authoritative; this page is deliberately
an organized navigation aid rather than a second schema source.

**2026-09-03 audit note:** the sections above were reconciled against the
actual `apps/api/src/routes/**` tree — roughly 20 public route families
existed in code with no representation here (chat, comments, reactions,
venues, top lists, theme gallery, disco widgets, TahtiJam, MCP, newsletter/
fan-sub public subscribe, support contact, and several others), plus one
factual bug (the follow endpoint is `/follow`, not `/followers`) and one
miscategorization (`downloads/` listed as admin-only when it's public). All
fixed above. If this note is more than a few months old, treat it as a
prompt to re-run the reconciliation rather than as still-current.
