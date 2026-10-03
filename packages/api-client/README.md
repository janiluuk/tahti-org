# @tahti/api-client

Typed SDK for the Tahti API, generated directly from apps/api's own Fastify route
schemas — not hand-maintained. Frontend code (apps/web) should call the API through
this package instead of raw `fetch`, so a route's shape only ever has to be defined
once (in the route itself).

Published to npm as [`@tahti/api-client`](https://www.npmjs.com/package/@tahti/api-client)
on every tahti-org release, for consumers outside this monorepo (e.g. `tahti-cli`).

## Install (outside the monorepo)

```sh
npm install @tahti/api-client@latest
```

ESM only (`"type": "module"`), Node 18+ or any runtime with a global `fetch`.
Types ship in the package — TypeScript consumers need `moduleResolution`
`NodeNext`, `Node16` or `Bundler` so the `exports` map resolves.

Every release is published as `0.<YYYYMMDD>.<N>` (see [Versioning](#versioning)),
so a caret range like `^0.20260926.2` never moves past that day. Depend on
`latest` (or `>=0.20260926.2`) to always build against the newest API, and
treat a type error after an upgrade as the API having changed.

Inside the monorepo, workspace packages keep importing the TypeScript source
(`main`/`exports` → `src/index.ts`); only the published tarball points at
`dist/` (via `publishConfig`).

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
task is keyed on apps/api's route/schema/plugin sources), and CI regenerates it
before typecheck (see `.github/workflows/ci.yml`). The file is gitignored —
never commit it, never edit it directly.

### Versioning

The version is derived from the tahti-org release tag, not bumped by hand:
release `2026-09-26-2` publishes `0.20260926.2` (a tag without a build suffix
counts as build 1). npm's semver order therefore matches release order, and
`latest` is always the SDK generated from the newest released API. The
`version` in this `package.json` is a placeholder for workspace use — CI sets
the real one at publish time.

There is no semver compatibility promise: any release may remove or reshape an
endpoint, and consumers find out at compile time.

### Publishing

The `publish-api-client` job in `.github/workflows/ci.yml` runs after the
release job on every push to `main`:

1. generates `src/schema.d.ts` from the exact `openapi.json` CI exported for
   that commit (`generate --spec <path>`; falls back to an in-job export if the
   artifact is missing),
2. runs this package's lint, typecheck and tests,
3. builds `dist/` (`pnpm build:dist` — refuses to build without schema types),
   packs it with `pnpm pack` and smoke-tests the tarball from a scratch npm
   project (`scripts/smoke-tarball.sh`),
4. `npm publish --provenance --access public` (skipped with a warning when the
   `NPM_TOKEN` secret is unset),
5. sends a `repository_dispatch` (`api-client-published`, `client_payload.version`)
   to `janiluuk/tahti-cli` when `TAHTI_CLI_DISPATCH_TOKEN` is set.

To reproduce locally:

```sh
pnpm --filter @tahti/api-client generate            # or: generate --spec path/to/openapi.json
pnpm --filter @tahti/api-client build:dist
cd packages/api-client && pnpm pack
bash scripts/smoke-tarball.sh tahti-api-client-*.tgz
```

## Testing

`src/index.test.ts` boots a real `apps/api` Fastify instance on an ephemeral
port and drives it over real HTTP (not `.inject()`) through this package's own
client — cookie auth, bearer-token auth, empty vs. populated responses, and
400/401/403 error shapes are all covered there as the reference pattern for
testing new endpoints added to the SDK.
