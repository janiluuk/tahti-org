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
Vocabulary map (import vs export vs integrations vs Store):
[`import-plugin-contracts.md`](import-plugin-contracts.md#vocabulary-map-do-not-conflate).

## Live provider: Revelator

| Capability | Route                                        | Ready?                                  |
| ---------- | -------------------------------------------- | --------------------------------------- |
| Submit     | `POST /api/me/releases/:id/revelator/submit` | yes                                     |
| Status     | `GET /api/me/releases/:id/revelator`         | yes                                     |
| Webhook    | `POST /api/webhooks/export/revelator`        | yes — updates `Release.revelatorStatus` |

Uniform ExportProvider aliases (same handlers):

- `POST /api/me/export-plugins/revelator/releases/:id/submit`
- `GET /api/me/export-plugins/revelator/releases/:id/status`

The registry lists the **canonical** Revelator paths above. Billing /
checkout remain Revelator-specific (`…/revelator/billing`, `…/checkout`).
Canonical submit documents 202. `GET /api/me/export-plugins` is tagged
`releases` (not `channel`).

### Webhook auth and payload

`Authorization: Bearer $INTERNAL_SECRET` or header
`X-Tahti-Webhook-Secret: $INTERNAL_SECRET`.

Body (Zod `RevelatorExportWebhookBodySchema`):

- Identity (at least one): `externalId` or `releaseId` (Tahti release id from
  submit), and/or `revelatorId`
- Status (at least one): `status` and/or `event` — mapped via
  `mapRevelatorWebhookStatus` onto `pending` | `submitted` | `delivered` |
  `failed`

Unknown release → `404`. Unmapped status → `400`. Updates are monotonic
(no `delivered` → `submitted` regression); `failed` is always allowed.

Production refuses stub DSP submit when `REVELATOR_API_KEY` is unset
(`packages/revelator`).

## Live provider: hearthis-export (sound-scoped)

| Capability | Route                                    | Success |
| ---------- | ---------------------------------------- | ------- |
| Submit     | `POST /api/me/sound/:id/export/hearthis` | 202     |

Uniform ExportProvider alias (same handler, also 202):

- `POST /api/me/export-plugins/hearthis-export/sounds/:id/submit`

Do **not** call the release-scoped `/export-plugins/:provider/releases/...`
aliases for hearthis — those only accept `revelator`.

Capability flags and paths agree both ways (`submit`/`status`/`webhook` iff
the matching path is non-null), same honesty rule as the import catalog.

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
