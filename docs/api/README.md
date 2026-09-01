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
| Search                         | `GET /api/v1/search`                                              |
| Latest/new discovery           | `GET /api/discover/latest-tracks`, `GET /api/discover/new-to-you` |
| Platform/news                  | `GET /api/v1/stats`, `GET /api/v1/news`                           |

### Listening, channels, and radio

| Purpose                      | Endpoints                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| Channel and now-playing data | `GET /api/channels/:slug`, `GET /api/channels/:slug/presence`                                  |
| Channel archive              | `GET /api/channels/:slug/items`                                                                |
| Tahti Radio now playing      | `GET /api/v1/radio`                                                                            |
| Radio history and schedule   | `GET /api/v1/radio/history`, `GET /api/v1/radio/recently-played`, `GET /api/v1/radio/rotation` |
| Internet-radio presets       | `GET /api/v1/internet-radio/presets/enabled`                                                   |
| Embeds                       | `GET /api/v1/embed/c/:slug`                                                                    |

### Artists, profiles, catalog, and collections

| Purpose                       | Endpoints                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Public artist profile         | `GET /api/v1/u/:username/profile`                                                                           |
| Artist mentions and fan tiers | `GET /api/v1/u/:username/mentions`, `GET /api/v1/u/:username/tiers`                                         |
| Collections and feeds         | `GET /api/v1/collections/:slug`, `GET /api/v1/collections/:slug/rss.xml`, `GET /api/v1/u/:username/rss.xml` |
| Smart links                   | `GET /api/v1/r/:slug`                                                                                       |
| Public releases/tracks        | `GET /api/v1/releases/:id`, `GET /api/v1/tracks/:id`                                                        |

### Engagement and community

| Purpose            | Endpoints                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| Artist follows     | `POST /api/v1/artists/:username/follow`, `GET /api/v1/artists/:username/followers`               |
| Track likes        | `POST /api/v1/c/:slug/archive/:itemId/like`                                                      |
| Reposts            | `POST /api/v1/c/:slug/archive/:itemId/repost`, `POST /api/v1/c/:slug/archive/:itemId/repost-ack` |
| Listen measurement | `POST /api/listen-events`, `POST /api/v1/listen/heartbeat`                                       |
| Abuse reports      | `POST /api/v1/reports`                                                                           |

### Governance and transparency

| Purpose             | Endpoints                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Members and motions | `GET /api/v1/governance/members`, `GET /api/v1/governance/motions`                                                 |
| Motion actions      | `POST /api/v1/governance/motions`, `POST /api/v1/governance/motions/:id/vote`                                      |
| Motion discussion   | `GET/POST /api/v1/governance/motions/:id/comments`                                                                 |
| Public transparency | `GET /api/v1/transparency/ytd`, `GET /api/v1/transparency/monthly_rollup`, `GET /api/v1/transparency/grants/:year` |
| Public resolutions  | `GET /api/v1/transparency/resolutions`, `GET /api/v1/transparency/motions`                                         |

### Authentication and member/artist studio

| Purpose                                     | Endpoint family                                                   |
| ------------------------------------------- | ----------------------------------------------------------------- |
| Sign in/session                             | `/api/auth/*`                                                     |
| Current member                              | `/api/me/*`                                                       |
| Artist channel/broadcast                    | `/api/me/channel/*`, `/api/me/stream-settings/*`                  |
| Releases, collections, and uploads          | `/api/me/releases`, `/api/me/collections`, `/api/uploads/*`       |
| Comments, fan subscriptions, and newsletter | `/api/me/comments/*`, `/api/me/fan-tiers`, `/api/me/newsletter/*` |

These families contain authenticated mutations. Consult the generated
OpenAPI operation before calling them because permissions and required fields
vary by resource state.

### Operations and administration

Board/admin and internal routes are intentionally not in the public document.
They are grouped in the full `/docs` reference and in the source by topic:

- `apps/api/src/routes/admin/` — users, content, grants, finance, radio,
  governance records, system logs, and moderation.
- `apps/api/src/routes/internal/` — ingest, stream control, radio handoff,
  service callbacks, and certificate checks.
- `apps/api/src/routes/releases/`, `uploads/`, and `downloads/` — media
  processing and delivery flows.

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
