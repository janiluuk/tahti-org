# Tahti API MCP endpoint and Tahti Jam group-listening sessions — 2026-09-01

## What shipped

Two independent additions to `apps/api`, both built on the existing
personal API-token auth (`apps/api/src/lib/api-token.ts`) rather than a new
mechanism.

### MCP (`/api/v1/mcp`)

A Streamable HTTP endpoint (stateless — a fresh `McpServer` +
`StreamableHTTPServerTransport` per request, closed over that request's
authenticated user) exposing a `search` tool over the same public
track/artist/collection search that already backed `/api/v1/search`.
`performSearch()` was extracted out of `routes/discover/search.ts` so the
REST route and the MCP tool share one implementation instead of drifting.

The auth plugin's method-based read/write gate (`GET`/`HEAD`/`OPTIONS` need
no `write` scope, everything else does) doesn't fit MCP's shape — every
call is `POST`, including read-only ones. Routes can now opt out via a new
`methodScopeCheckExempt` route `config` flag
(`apps/api/src/plugins/auth.ts`) and do their own per-tool scope check
instead (`hasWriteAccess()` in `routes/mcp/index.ts`, ready for the next
tool that mutates something).

Verified end to end with the real `@modelcontextprotocol/sdk` `Client` +
`StreamableHTTPClientTransport` driving a full `initialize` →
`tools/list` → `tools/call` round trip against a real listening server
(`routes/mcp/index.test.ts`), not just `app.inject()`.

### Tahti Jam (`/api/v1/jam`)

Synced group-listening sessions started from a playlist. One host device
stays the actual player and the source of truth for what's playing;
`JamSession`/`JamParticipant` (new Prisma models, `engagement` schema) just
mirror that state to participants over SSE (`GET /jam/:id/events`), fed by
the host posting state updates (`POST /jam/:id/state`, host-only). The
current track is a `currentTrackJson` snapshot on the session row rather
than an `ArchiveItem` relation — the host already has the full track in
hand when it pushes state, so a guest never needs a second lookup just to
render "now playing", and it stays valid for a track type that isn't an
`ArchiveItem` later without a schema change.

Routes: `POST /jam` (create, from an owned or public playlist),
`POST /jam/:code/join` (idempotent), `GET /jam/:id`, `GET /jam/:id/events`
(SSE), `POST /jam/:id/state` (host-only), `POST /jam/:id/leave`,
`DELETE /jam/:id` (host-only, ends for everyone).

**Known v1 gap, not solved here:** the SSE fan-out
(`apps/api/src/lib/jam-broadcast.ts`) is in-process only. If `apps/api`
ever runs more than one instance behind a load balancer, a participant
connected to a different instance than the one handling the host's state
push won't see updates — needs a Redis (or similar) pub/sub adapter before
that's true.

Frontend (tahti-nuclear's `tahti-web`): a "Start a Jam" button on playlist
pages, and a `/jam/$code` view built from `@nuclearplayer/ui`'s
`NuclearJam.*` components — see that repo's own `UI-REDESIGN-WORKLOG.md`.

## Landing on `main`

This landed while several other sessions were actively pushing to `main` in
parallel — schema/route files ended up interleaved mid-edit more than once.
Each commit here was staged file-by-file (and, for `schema.prisma`, hunk-by-
hunk via a temporary local revert-stage-restore) to keep this work isolated
from whatever else was in flight, rather than sweeping up others'
uncommitted changes with a broad `git add`.

The push also caught `main` already red on two counts unrelated to this
work — 3 files missing the required AGPL-3.0 header and 5 files (4 of them
from this change) failing `prettier --check` — which blocked
`deploy-production` from firing. Both were fixed in a follow-up commit
before the automatic production deploy could run.

## Validation

Both route files have real integration tests run against a disposable
Postgres container (not the shared dev DB) — `apps/api/src/routes/jam/index.test.ts`
(7 tests: playlist-visibility gate, host/guest roles, idempotent join,
host-only state push and end, leave-without-ending) and
`apps/api/src/routes/mcp/index.test.ts` (4 tests, including the full SDK
client round trip). `main` CI passed clean afterward (typecheck, lint,
AGPL headers, SDK drift check, unit/integration tests, API vital-flow and
user-journey e2e), and `deploy-production` shipped this to production
successfully — confirmed via a real `/health` response from the deployed
stack.
