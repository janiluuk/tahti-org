// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

interface HlsErrorData {
  fatal: boolean
  type: string
  details: string
}

interface HlsLevel {
  bitrate: number
}

interface HlsLevelSwitchedData {
  level: number
}

export interface HlsInstance {
  loadSource(url: string): void
  attachMedia(el: HTMLAudioElement): void
  destroy(): void
  levels: HlsLevel[]
  on(event: 'hlsError', callback: (event: 'hlsError', data: HlsErrorData) => void): void
  on(
    event: 'hlsLevelSwitched',
    callback: (event: 'hlsLevelSwitched', data: HlsLevelSwitchedData) => void,
  ): void
}

interface HlsConfig {
  liveDurationInfinity?: boolean
}

interface HlsConstructor {
  new (config?: HlsConfig): HlsInstance
  isSupported(): boolean
  Events: { ERROR: 'hlsError'; LEVEL_SWITCHED: 'hlsLevelSwitched' }
}

declare global {
  interface Window {
    Hls?: HlsConstructor
  }
}

const HLS_JS_SRC = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js'
const HLS_JS_SCRIPT_ID = 'hls-js-cdn'

/** Kicks off (or reuses) the hls.js CDN fetch and runs `onLoad` once it's ready —
 * immediately if `window.Hls` is already set. Safe to call more than once
 * (e.g. once eagerly on mount, again from the first live-track play click);
 * later calls just attach another listener to the in-flight script tag rather
 * than re-fetching. */
export function ensureHlsScriptLoading(onLoad?: () => void) {
  if (window.Hls) {
    onLoad?.()
    return
  }
  const existing = document.getElementById(HLS_JS_SCRIPT_ID) as HTMLScriptElement | null
  if (existing) {
    if (onLoad) existing.addEventListener('load', onLoad, { once: true })
    return
  }
  const script = document.createElement('script')
  script.id = HLS_JS_SCRIPT_ID
  script.src = HLS_JS_SRC
  if (onLoad) script.addEventListener('load', onLoad, { once: true })
  document.head.appendChild(script)
}
