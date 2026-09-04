# Export plugin capability contracts (2026-09-04)

## Requested

Unblock Nuclear `ExportProvider` by exposing submit/status/webhook contracts
from Tahti core, mirroring `GET /api/me/import-plugins`, without inventing a
second credential store.

## Implementation

- Added `@tahti/shared` `dto/export-plugin.ts` (`EXPORT_PLUGIN_CONTRACT_VERSION`,
  capabilities, `submitPath` / `statusPath` / `webhookPath`).
- Registry `EXPORT_PLUGIN_PROVIDERS` with live Revelator paths plus deep-link
  stubs for storefront DSPs / hearthis-export.
- `GET /api/me/export-plugins` plus thin aliases under
  `/api/me/export-plugins/revelator/releases/:id/{submit,status}` that
  delegate to shared Revelator helpers.
- Stub webhook `POST /api/webhooks/export/:provider` authenticated with
  `INTERNAL_SECRET` (Bearer or `X-Tahti-Webhook-Secret`).
- Docs: `docs/technical/export-plugin-contracts.md`,
  `docs/technical/integration-credential-lifecycle.md`.

## Follow-ups

- Wire Revelator webhook body → release status sync (currently accept + log).
- Per-DSP submit for hearthis-export once product defines the push API.
