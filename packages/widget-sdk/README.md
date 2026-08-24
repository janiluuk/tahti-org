# @tahti/widget-sdk

The SDK a Disco-widget bundle imports. See `example/live-status/` for a
complete working widget.

## Shipping a new Disco-widget

1. **Write it.** A widget is one file exporting `{ mount, unmount }`:

   ```ts
   import type { DiscoWidgetModule } from '@tahti/widget-sdk'

   const widget: DiscoWidgetModule = {
     async mount(container, host) {
       const context = await host.getContext()
       container.textContent = JSON.stringify(context)
       host.resize(container.scrollHeight)
     },
     unmount() {},
   }
   export default widget
   ```

   `host` is constructed and handed to you by the sandbox page — you never
   call `createHostApi()` yourself; it's exported for the sandbox bootstrap
   to use, not for widget code.

2. **Build it as one self-contained ES module.** The sandbox has no
   `require()`/import map — bundle everything, including the SDK itself:

   ```sh
   esbuild src/index.ts --bundle --format=esm --outfile=dist/bundle.js
   ```

   Must end up under 2 MB (`DISCO_WIDGET_BUNDLE_MAX_BYTES` in
   `@tahti/shared`).

3. **Register it** (admin-only in v1 — hand your built `dist/bundle.js` to an
   admin, or run these calls yourself if you have board access):

   ```
   POST /api/admin/disco-widgets            { slug, scope, name, description, authorName, categories }
   POST /api/admin/disco-widgets/:id/prepare-upload   { fileSizeBytes }   -> { uploadUrl, bundleKey }
   PUT  <uploadUrl>                          <dist/bundle.js bytes>
   POST /api/admin/disco-widgets/:id/publish-version  { version }
   POST /api/admin/disco-widgets/:id/approve
   ```

   It's live in its scope's store immediately — no redeploy.

4. **Iterate.** Any code change repeats steps 2–3 with a bumped `version`.
   Publishing mints a new content hash, which is pinned into the sandbox
   route's CSP for that version — a bundle can never be silently swapped
   post-approval without a version bump.

## What a widget can and can't do

A widget's `mount()` runs inside a sandboxed `<iframe sandbox="allow-scripts">`
with no `allow-same-origin` — it has an opaque origin with **no** access to
`document.cookie`, the parent page's DOM, top-level navigation, or (per that
sandbox route's CSP) the network. Everything a widget needs comes in through
`host.getContext()` (already-public data the platform chooses to send — see
`ArtistWidgetContextSchema` etc. in `@tahti/shared`) and `host` is the only
way out (`resize`, `openLink`). This is deliberate: unlike a desktop plugin,
a Disco-widget's code runs in front of every visitor to a page that installed
it, so it never gets ambient access to anything sensitive.
