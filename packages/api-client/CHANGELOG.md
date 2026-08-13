# @tahti/api-client

## 0.1.0 — 2026-08-13

Initial release. Typed client generated from apps/api's OpenAPI schema
(`openapi-typescript` + `openapi-fetch`), covering the full route graph.

- `createTahtiClient({ baseUrl, cookie | token })`
- Personal API token support (`Authorization: Bearer`) alongside session-cookie
  forwarding, matching the new `/api/me/api-tokens` self-service token system.
- `pnpm --filter @tahti/api-client generate` regenerates `src/schema.d.ts` from
  apps/api's live route schemas; wired into turbo (`@tahti/web#dev|build|typecheck`
  depend on it) and CI (`api-client-sdk-drift` job fails on drift).
