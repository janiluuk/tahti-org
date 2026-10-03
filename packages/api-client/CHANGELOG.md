# @tahti/api-client

Since the first npm publish, every tahti-org release publishes a new version
(`0.<YYYYMMDD>.<N>`, from the release tag) — see the GitHub release notes for
what changed in the API. This file only tracks changes to the package itself.

## Unreleased

- Published to npm from CI on every release (`publish-api-client` job), with
  `dist/` (ESM + `.d.ts`, generated schema types included) as the published
  entry point; workspace consumers keep importing `src/`.
- `generate --spec <path>` generates from an existing `openapi.json`.

## 0.1.0 — 2026-08-13

Initial release. Typed client generated from apps/api's OpenAPI schema
(`openapi-typescript` + `openapi-fetch`), covering the full route graph.

- `createTahtiClient({ baseUrl, cookie | token })`
- Personal API token support (`Authorization: Bearer`) alongside session-cookie
  forwarding, matching the new `/api/me/api-tokens` self-service token system.
- `pnpm --filter @tahti/api-client generate` regenerates `src/schema.d.ts` from
  apps/api's live route schemas; wired into turbo (`@tahti/web#dev|build|typecheck`
  depend on it) and CI (`api-client-sdk-drift` job fails on drift).
