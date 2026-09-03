// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// The only thing an Addon bundle imports. Bundle it in (the sandbox
// iframe has no require()/import map of its own) via any bundler:
//   esbuild src/index.ts --bundle --format=esm --outfile=dist/bundle.js
// See ../README.md for the full "ship a new widget" walkthrough.

import {
  ADDON_MESSAGE_SOURCE,
  ADDON_ROOT_ELEMENT_ID,
  isHostToWidgetMessage,
  type WidgetToHostMessage,
} from './protocol.js'

export * from './protocol.js'

import type { AddonHostApi, AddonModule } from './types.js'

export type { AddonHostApi, AddonModule } from './types.js'

/** Sets up the postMessage bridge to the host page. Call once, at module load. */
export function createHostApi(): AddonHostApi {
  let resolveInit: ((v: { context: unknown; config: unknown }) => void) | null = null
  const initPromise = new Promise<{ context: unknown; config: unknown }>((resolve) => {
    resolveInit = resolve
  })
  const configListeners = new Set<(config: unknown) => void>()

  window.addEventListener('message', (event: MessageEvent) => {
    if (!isHostToWidgetMessage(event.data)) return
    if (event.data.type === 'init') {
      resolveInit?.({ context: event.data.context, config: event.data.config })
    } else if (event.data.type === 'config-change') {
      for (const cb of configListeners) cb(event.data.config)
    }
  })

  function post(message: WidgetToHostMessage) {
    window.parent.postMessage(message, '*')
  }

  post({ source: ADDON_MESSAGE_SOURCE, type: 'ready' })

  return {
    async getContext<T>() {
      const { context } = await initPromise
      return context as T
    },
    resize(heightPx: number) {
      post({ source: ADDON_MESSAGE_SOURCE, type: 'resize', height: heightPx })
    },
    openLink(url: string) {
      post({ source: ADDON_MESSAGE_SOURCE, type: 'open-link', url })
    },
    onConfigChange(cb: (config: unknown) => void) {
      configListeners.add(cb)
      return () => configListeners.delete(cb)
    },
  }
}

/** The last line of a widget's entry file: wires up the host API and mounts
 * into the sandbox page's container. The bundle is inlined as the sandbox
 * route's ONLY script (see /widget-sandbox/[bundleHash]), so this has to be
 * self-contained top-level code — there's no separate host-side bootstrap
 * that could import this module and call mount() from outside it. */
export function mountAddon(module: AddonModule): void {
  const host = createHostApi()
  const container = document.getElementById(ADDON_ROOT_ELEMENT_ID) ?? document.body
  void module.mount(container, host)
  window.addEventListener('beforeunload', () => module.unmount())
}
