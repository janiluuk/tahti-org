# Export plugin capability contracts

Source of truth for the versioned `GET /api/me/export-plugins` registry in
`@tahti/shared` (`dto/export-plugin.ts`) and
`apps/api/src/lib/export-plugin-providers.ts`.

## Why this is separate from import

Import sources connect catalogs into Tahti. Export providers push releases
**out** (DSP delivery, optional storefront deep links). They share a
`submit` / `status` / `webhook` shape — not OAuth/search/tool import kinds.

Credentials for marketplace installables still live on
`GET` / `POST` / `DELETE /api/me/integrations`. See
[`integration-credential-lifecycle.md`](integration-credential-lifecycle.md).

## Live provider: Revelator

| Capability | Route                                        | Ready?                                                                      |
| ---------- | -------------------------------------------- | --------------------------------------------------------------------------- |
| Submit     | `POST /api/me/releases/:id/revelator/submit` | yes                                                                         |
| Status     | `GET /api/me/releases/:id/revelator`         | yes                                                                         |
| Webhook    | `POST /api/webhooks/export/revelator`        | path only — accept-and-log; `capabilities.webhook: false` until status sync |

Uniform ExportProvider aliases (same handlers):

- `POST /api/me/export-plugins/revelator/releases/:id/submit`
- `GET /api/me/export-plugins/revelator/releases/:id/status`

The registry lists the **canonical** Revelator paths above. Billing /
checkout remain Revelator-specific (`…/revelator/billing`, `…/checkout`).

### Webhook auth

`Authorization: Bearer $INTERNAL_SECRET` or header
`X-Tahti-Webhook-Secret: $INTERNAL_SECRET`. The receiver currently accepts
and logs the payload; full Revelator status sync is a follow-up. Until then
the catalog must not advertise `webhook: true`.

## Live provider: hearthis-export (sound-scoped)

| Capability | Route                                    |
| ---------- | ---------------------------------------- |
| Submit     | `POST /api/me/sound/:id/export/hearthis` |

Credentials via `/api/me/integrations` (`hearthis-export`). Status is stored
on the sound (`hearthisExportStatus`); there is no separate statusPath yet.

## Deep-link stubs

Storefront IDs (`spotify`, `apple`, `deezer`, `youtube`) appear in the catalog
with all capabilities `false` and null paths. Tahti Player may still deep-link
into Studio distribution / Add-ons; do not invent per-DSP submit routes until
product wires them.

## Client boundary

- **Tahti core** owns delivery jobs, billing gates, encrypted credentials,
  and this metadata registry.
- **Tahti Player** owns Configure UI and the `ExportProvider`
  adapter that calls submit/status and registers webhook URLs.
- Configure → test → save → enable for credentialed export plugins uses
  `/api/me/integrations` — do not add a parallel credential store.

## Parity checklist for new providers

1. Add a row to `EXPORT_PLUGIN_PROVIDERS` with accurate capabilities.
2. Point `submitPath` / `statusPath` / `webhookPath` at real routes (or
   `null` when deep-link only).
3. Implement or alias submit/status; add a webhook receiver when the
   provider sends callbacks.
4. Cover DTO parse + list route in tests.
5. If the provider has a Store listing, update sibling `../tahti-registry`.
