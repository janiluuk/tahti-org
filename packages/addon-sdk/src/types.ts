// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export interface AddonHostApi {
  /** Resolves once the host has sent the scope-specific public context payload
   * (see ArtistWidgetContextSchema etc. in @tahti/shared) plus this install's
   * own configJson. Safe to call multiple times — the same promise resolves
   * for the lifetime of one mount(). */
  getContext<T = unknown>(): Promise<T>
  /** Tell the host iframe to resize to fit content. Call after every layout
   * change — the sandbox has no way to observe its own iframe's size. */
  resize(heightPx: number): void
  /** Ask the host to navigate. The host validates/allowlists the URL (same-
   * origin tahti.live paths only) before acting — the sandboxed widget has no
   * top-navigation permission of its own. */
  openLink(url: string): void
  /** Fires if this install's configJson changes while mounted (e.g. an artist
   * tweaks the widget's settings without reloading the page). Returns an
   * unsubscribe function. */
  onConfigChange(cb: (config: unknown) => void): () => void
}

export interface AddonModule {
  mount(container: HTMLElement, host: AddonHostApi): void | Promise<void>
  unmount(): void
}
