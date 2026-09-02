# Import plugin capability contracts

Source of truth for the versioned `GET /api/me/import-plugins` registry in
`@tahti/shared` (`dto/import-plugin.ts`) and
`apps/api/src/lib/import-plugin-providers.ts`.

## Why three kinds

Import sources do not share one `start/status/import` shape:

| Kind | Lifecycle | Typical routes |
| --- | --- | --- |
| `oauth` | Connect → status → optional list → import → disconnect | `/api/me/{provider}/oauth/start`, `/api/me/{provider}` |
| `search` | Search → select → add/import (no OAuth account) | `/api/v1/imports/{provider}/search`, `/add` |
| `tool` / `upload` | Paste URL, local file, or stash locker | Studio upload / stash / releases deep links |

Tahti Player / Nuclear must keep separate adapter interfaces for these kinds.
Do not force search or paste-a-link tools through an OAuth connect modal.

## Client boundary

- **Tahti core** owns routes, OAuth, encrypted credentials, import jobs, and
  this metadata registry.
- **Tahti Player / Nuclear** owns Configure UI, adapter interfaces, and
  provider-specific cards in Settings → Add-ons (Import).
- Configuration stays in the player Configure action: enter settings, test,
  save, then enable. Do not add a parallel configuration surface in
  `apps/web`.

## Export / DSP delivery (blocked)

A behavioral `ExportProvider` (submit / status / webhook per DSP) is **not**
part of this contract. Current Nuclear `src/plugins/export` is metadata and
deep links into Studio distribution / Revelator only. Do not invent
provider-specific export submit/status/webhook routes here until product and
ops define them.

## Parity checklist for new providers

1. Add a row to `IMPORT_PLUGIN_PROVIDERS` with the correct `kind`.
2. Point `oauthStartPath` / `statusPath` / `searchPath` / `listPath` /
   `importPath` at real routes (or `null` when not applicable).
3. Extend the Nuclear adapter of the matching kind; do not widen OAuth cards
   to cover search/tool behavior.
4. Cover registry parsing in `@tahti/shared` tests and the provider list in
   API tests when behavior is added.
