# Tahti Player integration audit

Last audited: 2026-10-05.

The listen and studio client is maintained in the separate
[Tahti Player repository](https://github.com/janiluuk/tahti-player). It is a
Vite/Tauri client, not a second backend: production data, authentication,
chat, and media continue to come from this repository's API and services.
The beta deployment is documented in [`ops/beta-tahti-live.md`](../../ops/beta-tahti-live.md)
and the cutover plan in [`ops/nuclear-web-cutover.md`](../../ops/nuclear-web-cutover.md).

CLI for the same API lives in the player monorepo as `@tahti-player/tahti-cli`
(`../tahti-player/packages/tahti-cli`) — bearer-token library/releases/upload
commands against this API.

## Reference mastering audit

Tahti Player's new Reference mastering feature is implemented at
`packages/tahti-web/src/plugins/mastering/`. It is a browser-only Matchering
port: Web Audio decodes the Tahti source and uploaded reference, a Web Worker
runs the FFT/EQ/level-matching/Hyrax-limiter pipeline, and the result is a WAV
Blob for playback or download. It does not persist the uploaded reference or
the mastered result and therefore does not require a new API endpoint.

The feature's own technical contract and deliberate limitations are documented
in the Tahti Player repository at
`packages/tahti-web/src/plugins/mastering/README.md`; its DSP modules and UI
have colocated unit and end-to-end tests.

## API coverage and gaps

The client has a generated API reference at
`packages/tahti-web/docs/API-REFERENCE.md`, checked against this repository's
`openapi.json` by `check:api-docs`. After changing routes, export OpenAPI and
refresh the player reference hash:

```bash
pnpm --filter @tahti/api run openapi:export
pnpm --filter @tahti-player/tahti-web check:api-docs
```

Cross-repo production-readiness ledger:
[`docs/todo/api-player-gap-mapping.md`](../todo/api-player-gap-mapping.md).

Shipped (do not re-open as missing):

- Keyed sound share links — `POST/GET/DELETE /api/me/sound/:id/share(s)` +
  `?key=` on public track/comments (#568).
- Jam host participant control —
  `PATCH /api/v1/jam/:id/participants/:userId`.

No new endpoint is needed for Reference mastering. The existing archive editor
source endpoint supplies the hosted source audio; browser decoding supplies
the uploaded reference; and the output remains local. Any future “save
mastered result as archive/version” workflow would require a separately designed
authenticated upload/create or version endpoint and must not be implied by the
current plugin.

## Import plugin capability contracts

`GET /api/me/import-plugins` is the versioned metadata registry for OAuth,
search, and tool/upload import sources. See
[`import-plugin-contracts.md`](import-plugin-contracts.md). DSP export
submit/status/webhook lives on `GET /api/me/export-plugins` —
[`export-plugin-contracts.md`](export-plugin-contracts.md).

The existing API reference remains the contract source of truth for all other
Tahti Player calls. Run the client-side freshness check from the Tahti Player
checkout after an API route change:

```bash
pnpm --filter @tahti-player/tahti-web check:api-docs
```
