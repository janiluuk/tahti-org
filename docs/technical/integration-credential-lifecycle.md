# Integration credential lifecycle

Marketplace credentials for import, export, and fingerprinting providers use
the existing integrations API and encrypted storage in `@tahti/db`. Do not
invent a second credential store for Nuclear ExportProvider / ImportPlugin
Configure flows.

## Routes

| Action                          | Method   | Path                                 |
| ------------------------------- | -------- | ------------------------------------ |
| List install/connect state      | `GET`    | `/api/me/integrations`               |
| Install / update API-key fields | `POST`   | `/api/me/integrations/:slug/install` |
| Uninstall                       | `DELETE` | `/api/me/integrations/:slug`         |

Registry metadata (slug, fields, OAuth connect path, scope) lives in
`packages/shared/src/integration-providers.ts`. OAuth providers
(SoundCloud, Google Drive, …) keep their existing connect/disconnect
routes; the install endpoint rejects them.

## Storage (`@tahti/db`)

`IntegrationCredential` rows hold an AES-256-GCM blob (`fieldsEnc`) per
`(userId, providerSlug)`. Helpers:

- `upsertUserIntegrationCredential`
- `getUserIntegrationCredential`
- `removeUserIntegrationCredential`

Key material: `INTEGRATION_CREDENTIAL_ENC_KEY` (32-byte hex). Secrets never
return to the client — list responses expose only `installed` /
`connected` booleans.

## Nuclear Configure order

For API-key style plugins (including export targets that need keys):

1. **Configure** — open the player Configure modal; collect declared fields.
2. **Test** — run the provider connection test (installer hook when present,
   e.g. hearthis-export exchanges email/password for an API key).
3. **Save** — `POST /api/me/integrations/:slug/install` with the field map.
4. **Enable** — only after a successful save; do not silently enable an
   unverified provider.

OAuth providers: redirect to `oauthConnectPath`, then refresh list status
via `GET /api/me/integrations` / provider `statusPath`.

## Related contracts

- Import capability discovery: [`import-plugin-contracts.md`](import-plugin-contracts.md)
- Export capability discovery: [`export-plugin-contracts.md`](export-plugin-contracts.md)
