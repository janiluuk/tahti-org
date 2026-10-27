// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const MIKSERI_HOSTS = new Set(['mikseri.net', 'www.mikseri.net'])

export function mikseriTrackEmbedUrl(input: string): string | null {
  const trimmed = input.trim()
  if (/^\d+$/.test(trimmed)) {
    return `https://www.mikseri.net/embed/?type=1&parameter=${trimmed}`
  }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (!MIKSERI_HOSTS.has(url.hostname.toLowerCase())) return null
  if (url.pathname === '/embed/' || url.pathname === '/embed') {
    const type = url.searchParams.get('type')
    const parameter = url.searchParams.get('parameter')
    if (type !== '1' || !parameter || !/^\d+$/.test(parameter)) return null
    return `https://www.mikseri.net/embed/?type=1&parameter=${parameter}`
  }
  const segment = url.pathname.split('/').filter(Boolean).at(-1) ?? ''
  const trackId = segment.match(/(?:^|\.)(\d+)$/)?.[1]
  return trackId ? `https://www.mikseri.net/embed/?type=1&parameter=${trackId}` : null
}
