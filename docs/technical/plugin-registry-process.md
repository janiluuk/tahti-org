# Plugin registry change process

Tahti has two plugin-related registries with different owners. Keep them
separate when adding or updating a plugin:

- **Marketplace catalog:** `../tahti-registry/plugins.json` is the public Store
  catalog consumed by Tahti Player. It contains the plugin id, metadata,
  version, repository, and download URL.
- **Runtime install registry:** `../tahti-player/packages/player` persists
  installed entries in the user's `plugins.json`. It records the managed path,
  installation method, enabled state, warnings, and timestamps.

Tahti API provider catalogs (`GET /api/me/import-plugins` and
`GET /api/me/export-plugins`) are separate server-side contracts. Adding an API
provider does not automatically add a desktop Store plugin.

## Adding a plugin

1. Implement the plugin in `../tahti-player` and add its manifest, tests, and
   permissions there. Keep configuration in the plugin Configure flow; do not
   add a duplicate settings surface in Tahti core.
2. Add a row to `../tahti-registry/plugins.json` with the exact package id,
   current package version, repository, and downloadable artifact URL. Themes
   belong under `themes/` and the generated `themes.json` must be refreshed.
3. Validate the catalog in `../tahti-registry` with `pnpm validate` and
   `pnpm check-plugins`.
4. Run the player registry contract tests covering install, enable/disable,
   warnings, update, and removal. The existing runtime registry remains the
   source of truth during this preparation phase.
5. Open the player and catalog changes together, and link the catalog change
   from the player PR so a Store listing cannot be forgotten.

## Updating a plugin

1. Bump the plugin `package.json` version using semver.
2. Update the matching catalog row's `version` and `downloadUrl` in
   `../tahti-registry/plugins.json` (and regenerate `themes.json` for themes).
3. Verify that the download URL resolves to the artifact containing the bumped
   version and that the manifest id is unchanged.
4. Run `pnpm validate`, `pnpm check-plugins`, and the player contract tests.
5. Review auto-update behavior: the player compares catalog versions only for
   runtime entries installed with `installationMethod: "store"`. A code-only
   version bump without the catalog update will not reach users.

## Guardrails

Do not rename registry keys, change the AppData storage location, alter plugin
bootstrap ordering, or migrate callers from the compatibility adapter until the
adapter, rollback path, and player-app contract have been accepted. Do not use
the API import/export catalogs as a substitute for the public Store catalog.
