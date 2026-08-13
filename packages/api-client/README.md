# @tahti/api-client

Typed SDK for the Tahti API, generated directly from apps/api's own Fastify route
schemas — not hand-maintained. Frontend code (apps/web) should call the API through
this package instead of raw `fetch`, so a route's shape only ever has to be defined
once (in the route itself).

## Usage

```ts
import { createTahtiClient } from '@tahti/api-client'

// Server-side (Next.js Server Action / Route Handler) — forward the session cookie,
// since the browser's cookie jar isn't available there.
const api = createTahtiClient({
  baseUrl: process.env.API_URL!,
  cookie: `tahti_session=${sessionCookieValue}`,
})

// Third-party / scripted access — a personal token from /dashboard/settings/api.
const api = createTahtiClient({
  baseUrl: 'https://api.tahti.live',
  token: 'tahti_...',
})

const { data, error, response } = await api.GET('/api/me/api-tokens')
if (error) {
  // error is typed from the route's non-2xx response schemas
}
```

Every call returns `{ data, error, response }` ([openapi-fetch](https://openapi-ts.dev/openapi-fetch/)).
Path and query params, request bodies, and response shapes are all typed from
`src/schema.d.ts`, so a breaking route change is a compile error in the caller,
not a runtime surprise.

## Auth

- **Session cookie** (`cookie` option) — for server-side code in apps/web that
  already has the visitor's session.
- **Personal API token** (`token` option) — `Authorization: Bearer <token>`, for
  scripts, the hearthis.at import pipeline, or any third-party integration.
  Tokens are minted at `POST /api/me/api-tokens` (see the Settings → API tokens
  page) and default to read-only; mutating requests need a token created with
  `scopes: ['read', 'write']` — a read-only token gets a 403 on anything but
  GET/HEAD/OPTIONS.

## Keeping it in sync

`src/schema.d.ts` is generated, not hand-written — never edit it directly.
Regenerate after touching any Fastify route schema in apps/api:

```sh
pnpm --filter @tahti/api-client generate
```

This exports a fresh `openapi.json` from apps/api's live route graph (no server
needs to be running — see `apps/api/scripts/export-openapi.ts`) and feeds it to
`openapi-typescript`. turbo also runs this automatically before apps/web's
`dev`/`build`/`typecheck` (see the root `turbo.json` — this package's `generate`
task is keyed on apps/api's route/schema/plugin sources), and CI fails the build
if the committed `schema.d.ts` drifts from what a fresh generate produces — see
`.github/workflows/ci.yml`'s `api-client-sdk-drift` job.

### Versioning

This package follows semver against its own generated surface, independent of
apps/api's `0.0.1` (apps aren't published, so their version doesn't mean much;
this package's does, since apps/web and any external consumer depend on it):

- **patch** — new optional fields, new endpoints, docs-only changes.
- **minor** — a previously-optional field becomes required, a param is renamed,
  a scope requirement changes.
- **major** — an endpoint is removed or its auth model changes.

Bump `version` in `package.json` and add an entry to `CHANGELOG.md` in the same
commit as the regenerated `schema.d.ts`.

## Testing

`src/index.test.ts` boots a real `apps/api` Fastify instance on an ephemeral
port and drives it over real HTTP (not `.inject()`) through this package's own
client — cookie auth, bearer-token auth, empty vs. populated responses, and
400/401/403 error shapes are all covered there as the reference pattern for
testing new endpoints added to the SDK.
