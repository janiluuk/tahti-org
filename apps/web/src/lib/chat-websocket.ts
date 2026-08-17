// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const CHAT_PATH = '/connection/websocket'

export interface ChatPageLocation {
  hostname: string
  protocol: string
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]'
  )
}

export function resolveChatWebSocketUrl(
  configuredUrl: string | undefined,
  location: ChatPageLocation,
): string {
  const pageIsLocal = isLocalHostname(location.hostname)
  const fallback = pageIsLocal
    ? `ws://${location.hostname}:8000${CHAT_PATH}`
    : `wss://chat.tahti.live${CHAT_PATH}`

  if (!configuredUrl?.trim()) return fallback

  try {
    const url = new URL(configuredUrl)
    if (!pageIsLocal && isLocalHostname(url.hostname)) return fallback
    if (location.protocol === 'https:' && url.protocol === 'ws:') url.protocol = 'wss:'
    return url.toString()
  } catch {
    return fallback
  }
}
