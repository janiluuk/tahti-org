# Plugin registry extraction — inventory + interface (non-breaking prep)

**Status:** inventory complete; minimal `PluginRegistryStore` / `PluginRegistryHost`
interface and adapter plan defined (section 5). Do **not** move files, change
storage keys, alter discovery semantics, or change bootstrap order until adapter
contract tests and rollback plan are accepted.

**Repos:**

| Repo | Path |
| ---- | ---- |
| Tahti (this doc, remaining-work home) | `docs/todo/plugin-registry-extraction.md` |
| Player (Nuclear) pointer | `../tahti-nuclear/docs/todo/plugin-registry-extraction.md` |

**Source of truth for remaining-work bullets:**
`docs/remaining-work.md` → *Plugin registry separation*.

---

## Checklist (mirrors `docs/remaining-work.md`)

- [x] Inventory current registry responsibilities, persisted `plugins.json` format, and callers.
- [x] Define a minimal registry interface and compatibility adapter around the current implementation. → [§5](#5-minimal-compatibility-interface-and-adapter-plan)
- [ ] Add contract tests for install, enable/disable, warnings, update, and removal behavior.
- [ ] Define ownership between player core, plugin SDK, and import-provider plugins.
- [ ] Extract only after adapter tests and a migration/rollback plan are accepted.

**Guardrail (do not violate during prep):** keep current registry as runtime
source of truth; no key / path / bootstrap-order changes until adapter +
rollback plan are accepted. Same wording in
`../tahti-nuclear/AGENTS.md` (*Runtime registry separation guardrail*) and
root `AGENTS.md` / `docs/remaining-work.md`.

---

## Catalog vs runtime (do not confuse)

There are **three** different “plugin registry / store” concepts. Only the
first is the extraction target.

| Concept | What it is | Where |
| ------- | ---------- | ----- |
| **Runtime install registry** | Local list of *installed* plugins (enable flag, path, warnings) | Player: `packages/player/src/services/plugins/pluginRegistry.ts` → Tauri `LazyStore('plugins.json')` under AppData |
| **Marketplace catalog** | Remote list of *available* store plugins (version, downloadUrl, repo) | [janiluuk/tahti-registry](https://github.com/janiluuk/tahti-registry) `plugins.json`; fetched by `packages/player/src/apis/pluginMarketplaceApi.ts` from `https://raw.githubusercontent.com/janiluuk/tahti-registry/master` |
| **tahti-web Add-ons UI** | Browser over in-app subsystems (import, radio, widgets, export metadata, …) | `packages/tahti-web` `PluginStorePanel`, `PLUGIN-STORE-PLAN.md` — **not** the Tauri runtime registry |

Auto-update compares **catalog** `version` / `downloadUrl` to **runtime**
registry entries with `installationMethod === 'store'`. A code-only version
bump that never lands in `tahti-registry` will not reach users.

**Sibling checkout note:** `../tahti-registry` was not present on this machine
at inventory time; catalog shape below was taken from the live GitHub
`plugins.json` (same URL the player uses).

Also **not** the runtime registry:

- `packages/player/src/services/widgetRegistry.ts` — in-memory SDK custom-widget map (`plugin.<pluginId>.<widgetId>`).
- tahti-web code registries (`import-sources/registry.ts`, `audio-fx`, `multicast`, `export`) — compile-time metadata/adapters.
- Tahti API `GET /api/me/import-plugins` / `export-plugins` — server-side provider catalogs for studio/import, separate from desktop zip plugins.

---

## 1. Responsibilities (runtime registry)

Owned by **player core** today (`@tahti-player/player`), centered on
`pluginRegistry.ts` + consumers (`pluginStore`, `pluginBootstrap`,
`pluginAutoUpdate`, `useInstallPlugin`).

| Responsibility | Behavior today |
| -------------- | -------------- |
| **Persist install list** | Keyed entries in AppData `plugins.json` (`plugins.<id>` → `PluginRegistryEntry`) |
| **Discovery on startup** | `listRegistryEntries()`, sort by `installedAt` ascending, load only paths under managed `plugins/` dir |
| **Install (store)** | Download zip → extract → `upsertRegistryEntry` (`installationMethod: 'store'`) → `loadPluginFromPath` → `enablePlugin` |
| **Install (dev)** | User picks folder → `loadPluginFromPath` copies into managed dir, upserts with `installationMethod: 'dev'` + `originalPath` |
| **Load / compile** | `PluginLoader` reads `package.json`, compiles entry, creates instance + API (`createPluginAPI`) |
| **Enable / disable** | Zustand `enablePlugin` / `disablePlugin` call plugin lifecycle hooks, then `setRegistryEntryEnabled` |
| **Warnings** | Manifest/permission warnings on load; load failures on hydrate merge into `warnings` via `setRegistryEntryWarnings` (entry kept) |
| **Update (store)** | After hydrate, `checkAndUpdatePlugins` if `core.plugins.autoUpdate`; semver-gt catalog version → unload → load new → re-enable |
| **Reload (dev only)** | Re-read `originalPath`, reinstall managed copy, upsert registry |
| **Removal** | Unload → delete managed files → `removeRegistryEntry` (also works for orphan registry-only entries) |

**Out of scope for this registry (but adjacent):**

- Choosing active metadata/streaming/discovery providers (`providersHost` /
  Sources UI) — runs *after* hydrate via `providersHost.resolveActiveOnBootstrap()`.
- Marketplace browse/search UI (`PluginStore.tsx`) — reads catalog API, not
  local `plugins.json` keys (except “is installed” via `usePluginStore`).

---

## 2. Persisted `plugins.json` format (runtime)

### Path / storage

- **File name:** `plugins.json` (constant `REGISTRY_FILE` in
  `packages/player/src/services/plugins/pluginRegistry.ts`).
- **Mechanism:** `@tauri-apps/plugin-store` `LazyStore` — lives in the Tauri
  **AppData** directory (same family as settings/queue stores). Tests mock
  AppData as `/home/user/.local/share/com.nuclearplayer`.
- **Managed plugin files (separate from the registry file):**
  `{appDataDir}/plugins/{id}/{version}/` via `pluginDir.ts`.
- **Key prefix:** `plugins.` + plugin id (e.g. `plugins.nuclear-plugin-youtube`).
  `listRegistryEntries` only returns keys starting with that prefix.
- **Schema versioning:** none on the runtime store. Entries are a flat TS type
  cast from stored values (`value as PluginRegistryEntry`). No Zod schema on
  read/write today.

### Entry type (`PluginRegistryEntry`)

```ts
type PluginInstallationMethod = 'dev' | 'store';

type PluginRegistryEntry = {
  id: string;
  version: string;
  path: string; // absolute managed path …/plugins/{id}/{version}
  installationMethod: PluginInstallationMethod;
  originalPath?: string; // set for dev (reload source)
  enabled: boolean;
  installedAt: string; // ISO-8601
  lastUpdatedAt: string; // ISO-8601
  warnings?: string[]; // omitted when empty
};
```

### Example shape (from builders / seed helpers)

Logical store contents (key → value), not a top-level `{ plugins: [...] }`
array — unlike the **catalog** file:

```json
{
  "plugins.plain": {
    "id": "plain",
    "version": "1.0.0",
    "path": "/home/user/.local/share/com.nuclearplayer/plugins/plain/1.0.0",
    "installationMethod": "store",
    "enabled": false,
    "installedAt": "2025-01-01T00:00:00.000Z",
    "lastUpdatedAt": "2025-01-01T00:00:00.000Z",
    "warnings": []
  }
}
```

Fixtures: `packages/player/src/test/builders/PluginRegistryEntryBuilder.ts`,
`packages/player/src/test/utils/seedPlugins.ts`.

### Contrast: marketplace catalog `plugins.json`

Remote document (Zod `RegistrySchema` in `pluginMarketplaceApi.ts`):

```json
{
  "$schema": "./schema/plugins.schema.json",
  "version": 1,
  "plugins": [
    {
      "id": "nuclear-plugin-discogs",
      "name": "Discogs",
      "description": "…",
      "author": "nukeop",
      "repo": "NuclearPlayer/nuclear-plugin-discogs",
      "category": "metadata",
      "categories": ["metadata"],
      "tags": ["discogs", "metadata"],
      "version": "0.2.0",
      "downloadUrl": "https://github.com/…/plugin.zip",
      "addedAt": "2026-01-27T00:00:00Z"
    }
  ]
}
```

Same **filename**, different **role, host, and schema**. Do not merge or
rename without an explicit migration plan.

---

## 3. Callers (significant import / call sites)

### Core persistence API

| File | Role |
| ---- | ---- |
| `/home/jani/workspace/tahti-nuclear/packages/player/src/services/plugins/pluginRegistry.ts` | LazyStore CRUD: list/get/upsert/enabled/warnings/remove |
| `/home/jani/workspace/tahti-nuclear/packages/player/src/services/plugins/pluginBootstrap.ts` | Startup hydrate from registry; warnings on failure; kicks auto-update |
| `/home/jani/workspace/tahti-nuclear/packages/player/src/stores/pluginStore.tsx` | In-memory plugin instances; install/enable/disable/reload/remove; writes registry |
| `/home/jani/workspace/tahti-nuclear/packages/player/src/services/plugins/pluginAutoUpdate.ts` | Store-plugin updates vs marketplace catalog |
| `/home/jani/workspace/tahti-nuclear/packages/player/src/hooks/useInstallPlugin.ts` | Store install mutation (upsert + load + enable) |
| `/home/jani/workspace/tahti-nuclear/packages/player/src/initPlayerApp.tsx` | Schedules `hydratePluginsFromRegistry()` after settings/themes init |

### Load / filesystem / marketplace (depend on registry flow)

| File | Role |
| ---- | ---- |
| `…/services/plugins/PluginLoader.ts` | Manifest parse, compile, instantiate |
| `…/services/plugins/pluginDir.ts` | Managed `plugins/{id}/{version}` install/remove |
| `…/services/plugins/pluginDownloader.ts` | Zip download/extract for store install/update |
| `…/services/plugins/createPluginAPI.ts` | Host API passed into plugin instances |
| `…/apis/pluginMarketplaceApi.ts` | **Catalog** client (`PluginRegistryApi` class name — remote only) |

### UI

| File | Role |
| ---- | ---- |
| `…/views/Plugins/PluginStore.tsx` | Store tab; `useInstallPlugin` |
| `…/views/Plugins/InstalledPlugins.tsx` | Dev folder install via `loadPluginFromPath` |
| `…/views/Plugins/ConnectedPluginItem.tsx` | Enable/disable/reload/remove |
| `…/views/Settings/CustomWidgetField.tsx` | Reads `usePluginStore` API for settings widgets |

### Tests / builders (contract-test foundation)

| File | Role |
| ---- | ---- |
| `…/App.hydration.test.tsx` | Bootstrap order, managed-path filter, warnings persistence, timings; **todo** for enable persist across restart |
| `…/stores/pluginStore.test.ts` | load/enable/disable/reload/remove/unload |
| `…/services/plugins/pluginAutoUpdate.test.ts` | Update skip/apply vs catalog |
| `…/test/utils/seedPlugins.ts` | Seeds registry + optional store state |
| `…/test/builders/PluginRegistryEntryBuilder.ts` | Entry factory |
| `…/views/Plugins/PluginStore.test.tsx` | Catalog UI (mocks remote `plugins.json`) |
| `…/services/plugins/PluginLoader.test.ts` | Loader only (no registry file) |

### Devtools

| File | Role |
| ---- | ---- |
| `…/devtools/registerZustandStores.ts` | Exposes `usePluginStore` to DevTools |

**Non-callers (easy to mis-grep):** tahti-web `PluginStorePanel`,
`pluginInstallStore`, `e2e/plugin-store.spec.ts` — Add-ons / studio surfaces,
not Tauri `pluginRegistry.ts`. Storybook `PluginStoreItem` is UI chrome only.

---

## 4. Bootstrap order

From `initPlayerApp.tsx` (simplified):

1. `initLogStream()`
2. **Await chain:** settings → shortcuts → queue → favorites → playlists →
   core settings → discovery → MCP → MPD → HTTP API → bridge → Discord →
   playback bridge → history → language → advanced theme watcher →
   marketplace themes → theme store hydrate → apply theme
3. **Then (fire-and-forget, not awaited before first paint):**
   - `hydratePluginsFromRegistry()`
   - app updater check
   - `ytdlpEnsureInstalled()`
4. `root.render(<App />)` — runs in the same turn after scheduling hydrate;
   plugins may still be loading while UI mounts

Inside `hydratePluginsFromRegistry()`:

1. `startStartup()`
2. `listRegistryEntries()` → sort by `installedAt` ascending
3. Skip entries whose `path` is not under managed plugins dir (dev
   non-managed paths intentionally unsupported — TODO in bootstrap)
4. Per entry: `PluginLoader` → metadata → API → load → put in
   `usePluginStore` with `enabled: false` → if registry `enabled`, call
   `enablePlugin`
5. On load error: merge message into registry `warnings`, keep entry, no
   in-memory plugin
6. `providersHost.resolveActiveOnBootstrap()`
7. `finishStartup(totalMs)`
8. `void checkAndUpdatePlugins()` (async; respects `core.plugins.autoUpdate`)

**Invariant for extraction:** preserve this relative order (settings before
hydrate; providers resolve after plugin load; auto-update after hydrate). Do
not make hydrate block first paint unless a later accepted plan says so.

---

## 5. Minimal compatibility interface and adapter plan

**Target repo (implementation):** `../tahti-nuclear` →
`packages/player/src/services/plugins/`.

Wrap existing functions; do **not** change LazyStore keys, file name
(`plugins.json`), key prefix (`plugins.`), or managed path layout. The adapter
is a thin boundary so callers stop importing `pluginRegistry.ts` directly.

### 5.1 Contract module (new file, types only)

Add `packages/player/src/services/plugins/pluginRegistryContract.ts` — shared
types + interfaces, no Tauri imports:

```ts
/** Mirrors exports from pluginRegistry.ts today — keep in sync until extraction. */
export type PluginInstallationMethod = 'dev' | 'store';

export type PluginRegistryEntry = {
  id: string;
  version: string;
  path: string;
  installationMethod: PluginInstallationMethod;
  originalPath?: string;
  enabled: boolean;
  installedAt: string;
  lastUpdatedAt: string;
  warnings?: string[];
};

/** Storage constants — frozen for adapter compatibility. */
export const PLUGIN_REGISTRY_FILE = 'plugins.json' as const;
export const PLUGIN_REGISTRY_KEY_PREFIX = 'plugins.' as const;

/**
 * Persistence + query — maps 1:1 to pluginRegistry.ts free functions.
 * Only implementation of this interface may touch LazyStore / plugins.json.
 */
export interface PluginRegistryStore {
  list(): Promise<PluginRegistryEntry[]>;
  get(id: string): Promise<PluginRegistryEntry | undefined>;
  upsert(entry: PluginRegistryEntry): Promise<void>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
  setWarnings(id: string, warnings: string[]): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Marketplace row subset needed for store install (from pluginMarketplaceApi). */
export type MarketplacePluginRelease = {
  id: string;
  version: string;
  downloadUrl: string;
  repo?: string;
};

/**
 * Host-facing lifecycle — UI, bootstrap, auto-update.
 * Today spread across pluginStore, pluginBootstrap, pluginAutoUpdate,
 * useInstallPlugin; not owned by pluginRegistry.ts alone.
 */
export interface PluginRegistryHost {
  hydrateFromRegistry(): Promise<void>;
  installFromPath(path: string): Promise<void>;
  installFromMarketplace(plugin: MarketplacePluginRelease): Promise<void>;
  enable(id: string): Promise<void>;
  disable(id: string): Promise<void>;
  reloadDev(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  checkAndUpdateStorePlugins(): Promise<void>;
}
```

Re-export types from `pluginRegistry.ts` during transition (deprecated
re-exports) so existing imports keep compiling until callers migrate.

### 5.2 LazyStore adapter (new file, delegates to current impl)

Add `packages/player/src/services/plugins/pluginRegistryAdapter.ts`:

```ts
import type { PluginRegistryStore } from './pluginRegistryContract';
import {
  getRegistryEntry,
  listRegistryEntries,
  removeRegistryEntry,
  setRegistryEntryEnabled,
  setRegistryEntryWarnings,
  upsertRegistryEntry,
} from './pluginRegistry';

/** Default runtime adapter — wraps today's pluginRegistry.ts without changing storage. */
export const createLazyStorePluginRegistry = (): PluginRegistryStore => ({
  list: () => listRegistryEntries(),
  get: (id) => getRegistryEntry(id),
  upsert: (entry) => upsertRegistryEntry(entry),
  setEnabled: (id, enabled) => setRegistryEntryEnabled(id, enabled),
  setWarnings: (id, warnings) => setRegistryEntryWarnings(id, warnings),
  remove: (id) => removeRegistryEntry(id),
});

/** Process-wide singleton for player core (same LazyStore instance as today). */
export const pluginRegistryStore: PluginRegistryStore =
  createLazyStorePluginRegistry();
```

`pluginRegistry.ts` stays the LazyStore owner; the adapter is the **only**
supported import path for new code. After extraction, swap
`createLazyStorePluginRegistry` for a remote or package-backed impl without
touching callers.

### 5.3 Function mapping (today → contract)

| `pluginRegistry.ts` export | `PluginRegistryStore` method | Notes |
| -------------------------- | ---------------------------- | ----- |
| `listRegistryEntries()` | `list()` | No sort in store layer; bootstrap sorts by `installedAt` |
| `getRegistryEntry(id)` | `get(id)` | Returns `undefined` when missing |
| `upsertRegistryEntry(entry)` | `upsert(entry)` | Always calls `store.save()` |
| `setRegistryEntryEnabled(id, enabled)` | `setEnabled(id, enabled)` | No-op + warn log if entry missing |
| `setRegistryEntryWarnings(id, warnings)` | `setWarnings(id, warnings)` | Empty array → omit `warnings` field |
| `removeRegistryEntry(id)` | `remove(id)` | Deletes `plugins.{id}` key |

| Current module / symbol | `PluginRegistryHost` method | Notes |
| ----------------------- | --------------------------- | ----- |
| `hydratePluginsFromRegistry()` in `pluginBootstrap.ts` | `hydrateFromRegistry()` | Preserves bootstrap order (§4) |
| `usePluginStore.loadPluginFromPath` | `installFromPath()` | Dev folder + managed copy |
| `useInstallPlugin` mutation | `installFromMarketplace()` | Catalog download → upsert → load → enable |
| `usePluginStore.enablePlugin` | `enable()` | Calls `onEnable`, then `setEnabled` |
| `usePluginStore.disablePlugin` | `disable()` | Calls `onDisable`, then `setEnabled` |
| `usePluginStore.reloadPlugin` | `reloadDev()` | Dev entries only (`originalPath`) |
| `usePluginStore.removePlugin` | `remove()` | Unload + managed dir + registry key |
| `checkAndUpdatePlugins()` in `pluginAutoUpdate.ts` | `checkAndUpdateStorePlugins()` | Uses `list()` + marketplace catalog |

### 5.4 Caller migration (tahti-nuclear, incremental)

Migrate imports **one PR at a time**; behavior must stay identical.

| File | Today | After adapter step |
| ---- | ----- | ------------------ |
| `pluginBootstrap.ts` | `listRegistryEntries`, `getRegistryEntry`, `setRegistryEntryWarnings` | `pluginRegistryStore.list/get/setWarnings` |
| `pluginStore.tsx` | `get/upsert/setEnabled/removeRegistryEntry` | `pluginRegistryStore.*` |
| `pluginAutoUpdate.ts` | `listRegistryEntries` | `pluginRegistryStore.list` |
| `useInstallPlugin.ts` | `upsertRegistryEntry` | `pluginRegistryStore.upsert` |
| `test/utils/seedPlugins.ts` | `upsertRegistryEntry` | `pluginRegistryStore.upsert` |
| Tests importing `getRegistryEntry` directly | direct import | `pluginRegistryStore.get` |

**Do not migrate yet:** `PluginLoader`, `pluginDir`, `pluginDownloader`,
`pluginMarketplaceApi` — they do not touch `plugins.json` keys.

Optional follow-up (not blocking interface sign-off): thin
`pluginRegistryHost.ts` façade that re-exports bootstrap + store methods as
`PluginRegistryHost` for tests and future package extraction.

### 5.5 Rollback plan

1. **Adapter-only PR** — no storage changes; rollback = revert import paths to
   `pluginRegistry.ts` (adapter file can remain unused).
2. **Singleton** — keep `pluginRegistryStore` as the only exported instance;
   no dependency injection until contract tests pass (avoids half-migrated
   graphs).
3. **Feature flag (optional)** — env `TAHTI_PLUGIN_REGISTRY_ADAPTER=0` could
   re-export legacy functions from adapter module; only add if a staged rollout
   is needed (default on).
4. **Extraction gate** — do not move LazyStore to another repo/package until
   §6 contract tests run against `pluginRegistryStore` and pass on CI; rollback
   then means pointing `createLazyStorePluginRegistry` back at in-repo
   `pluginRegistry.ts`.

### 5.6 Invariants (must not change in adapter PRs)

- File: AppData `plugins.json` via `@tauri-apps/plugin-store` `LazyStore`.
- Keys: `plugins.{id}` only (`PREFIX = 'plugins.'`).
- Managed installs: `{appDataDir}/plugins/{id}/{version}/`.
- Bootstrap order: §4 unchanged.
- Marketplace catalog remains separate (`tahti-registry` remote JSON).

---

## 6. Contract tests to add later

Existing coverage is strong for store/hydration but not framed as a stable
**registry contract**. Prefer adding an explicit suite (or tagging cases)
against the adapter once it exists. Do not rewrite production code for tests
yet.

### Install

- [ ] Store install: catalog release → registry entry `installationMethod: 'store'`, managed path, then enabled.
- [ ] Dev install from folder: `installationMethod: 'dev'`, `originalPath` set, enabled defaults false unless re-install of previously enabled.
- [ ] Re-load same id while already loaded is no-op (store state unchanged).
- [ ] Failed load does not leave a half-enabled UI plugin (or documents current error reporting).

### Enable / disable

- [ ] Enable calls `onEnable`, sets in-memory + registry `enabled: true`.
- [ ] Disable calls `onDisable`, persists `enabled: false`.
- [ ] **Across restart:** enabled flag in registry is respected on next
      `hydratePluginsFromRegistry` (explicit `it.todo` already in
      `App.hydration.test.tsx`).
- [ ] Missing id / missing instance throws (current store behavior).

### Warnings

- [ ] Unknown permissions → `warnings` on upsert and `warning` flag in store.
- [ ] Hydrate load failure → registry entry retained with merged warnings; not
      listed in Installed UI.
- [ ] Clearing warnings: empty array → field omitted (`undefined`).

### Update

- [ ] Auto-update off → no download.
- [ ] Dev entries never auto-updated.
- [ ] Store entry with catalog newer version → unload/load/re-enable when was enabled.
- [ ] Catalog missing `version`/`downloadUrl` → skip.
- [ ] Failed update logs warn and leaves previous install (document actual recovery).

### Removal

- [ ] Remove loaded plugin: unload + delete managed dir + registry key gone.
- [ ] Remove orphan registry entry (no in-memory plugin) still deletes files + key.
- [ ] Refuse delete outside managed plugins dir (`removeManagedPluginInstall`).

### Discovery / bootstrap (regression locks)

- [ ] Load order = `installedAt` ascending.
- [ ] Paths outside managed dir skipped.
- [ ] `providersHost.resolveActiveOnBootstrap` runs after successful hydrate loop.
- [ ] Startup timings recorded per plugin id.

---

## 7. Ownership split draft

| Boundary | Owns | Does not own |
| -------- | ---- | ------------ |
| **Player core** (`packages/player`) | Runtime registry persistence, bootstrap, PluginLoader host, managed dirs, Install/Installed UI, auto-update orchestration, providersHost wiring | Marketplace catalog content; tahti-web Add-ons; API import-provider list |
| **Plugin SDK** (`packages/plugin-sdk`) | `TahtiPlugin` lifecycle (`onLoad`/`onEnable`/…), `TahtiPluginAPI`, manifest/metadata types, widget registry *types* | Persistence of `plugins.json`; download/install |
| **Zip / Nuclear-style plugins** (external repos + catalog rows) | Plugin implementation, `package.json` / `tahti` manifest, GitHub `plugin.zip` releases | Local install list |
| **tahti-registry** | Public Store catalog (`plugins.json`, themes), versions/downloadUrls users see | Runtime enable state; on-disk managed copies |
| **Import-provider plugins / tahti-web** | Studio import OAuth/search/tool adapters; Settings → Add-ons categories; talks to Tahti API `GET /api/me/import-plugins` | Desktop Tauri runtime registry |
| **Tahti API** (`../tahti`) | Server import/export plugin catalogs, credentials | Desktop `LazyStore` `plugins.json` |

**Extraction end-state (aspirational, not now):** runtime registry (+
optionally loader/dir helpers) as a separately owned package or repo with a
stable `PluginRegistryStore` / `PluginRegistryHost` contract; player depends
on the adapter; catalog and tahti-web Add-ons remain separate products.

---

## Related docs

| Doc | Why |
| --- | --- |
| `docs/remaining-work.md` | Checklist this file tracks |
| `../tahti-nuclear/AGENTS.md` | Catalog vs runtime + separation guardrail |
| `../tahti-nuclear/packages/docs/plugins/plugin-system.md` | User-facing install + registry description |
| `../tahti-nuclear/packages/docs/plugins/plugin-store.md` | Store UI + auto-update |
| `../tahti-nuclear/packages/tahti-web/PLUGIN-STORE-PLAN.md` | **Different** Add-ons extraction map (do not conflate) |
| `docs/technical/import-plugin-contracts.md` | API import-provider catalog (server) |

---

## Inventory notes / open risks

1. **Dual `plugins.json` names** — highest confusion risk for agents and docs.
2. **No runtime schema version** — extraction should add read validation behind
   the adapter without changing on-disk keys.
3. **`useInstallPlugin` double upsert** — writes a store entry then
   `loadPluginFromPath` upserts again (path/version may change after managed
   copy); contract tests should lock intended final entry shape.
4. **Hydrate is not awaited before render** — behavior to preserve or
   consciously change only with UX sign-off.
5. **Class name `PluginRegistryApi`** in marketplace client refers to the
   **catalog**, not the runtime store.
