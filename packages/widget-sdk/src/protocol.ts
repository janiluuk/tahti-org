// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// The postMessage wire protocol between a widget's sandboxed iframe and the
// host page. Both sides import this file — the widget via createHostApi()
// (index.ts), the host via DiscoWidgetFrame (apps/web) — so the message
// shapes can never drift out of sync between the two ends.
//
// The sandbox iframe has no allow-same-origin, so its document has an opaque
// origin — postMessage to/from it necessarily uses targetOrigin '*'. That's
// fine: every field here is already public/non-sensitive by the time it
// reaches this layer (see ArtistWidgetContextSchema etc. in @tahti/shared).
// The trust boundary is verifying `event.source` against the exact iframe
// window, not the (meaningless, "null") origin string.

export const DISCO_WIDGET_MESSAGE_SOURCE = 'disco-widget' as const

/** The element id the sandbox page's static HTML provides for a widget to
 * mount into — see mountDiscoWidget() in index.ts and the sandbox page. */
export const DISCO_WIDGET_ROOT_ELEMENT_ID = 'disco-widget-root'

export type HostToWidgetMessage =
  | { source: typeof DISCO_WIDGET_MESSAGE_SOURCE; type: 'init'; context: unknown; config: unknown }
  | { source: typeof DISCO_WIDGET_MESSAGE_SOURCE; type: 'config-change'; config: unknown }

export type WidgetToHostMessage =
  | { source: typeof DISCO_WIDGET_MESSAGE_SOURCE; type: 'ready' }
  | { source: typeof DISCO_WIDGET_MESSAGE_SOURCE; type: 'resize'; height: number }
  | { source: typeof DISCO_WIDGET_MESSAGE_SOURCE; type: 'open-link'; url: string }

function hasDiscoWidgetSource(data: unknown): data is { source: unknown } {
  return typeof data === 'object' && data !== null && 'source' in data
}

export function isHostToWidgetMessage(data: unknown): data is HostToWidgetMessage {
  return hasDiscoWidgetSource(data) && data.source === DISCO_WIDGET_MESSAGE_SOURCE
}

export function isWidgetToHostMessage(data: unknown): data is WidgetToHostMessage {
  return hasDiscoWidgetSource(data) && data.source === DISCO_WIDGET_MESSAGE_SOURCE
}
