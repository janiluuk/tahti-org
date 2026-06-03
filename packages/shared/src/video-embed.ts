// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export type VideoEmbed = {
  provider: 'youtube' | 'vimeo'
  embedUrl: string
}

/** Parse a YouTube or Vimeo watch URL into an iframe-safe embed URL (M24). */
export function parseVideoEmbedUrl(url: string): VideoEmbed | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    const host = parsed.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0]
      if (!id) return null
      return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` }
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = parsed.searchParams.get('v')
      if (!id) return null
      return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` }
    }

    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const parts = parsed.pathname.split('/').filter(Boolean)
      const id = parts[parts.length - 1]
      if (!id || !/^\d+$/.test(id)) return null
      return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}` }
    }
  } catch {
    return null
  }

  return null
}
