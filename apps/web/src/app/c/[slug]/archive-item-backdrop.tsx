// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { parseVideoEmbedUrl } from '@tahti/shared'

export function resolveArchiveBackground(backgroundUrl: string | null | undefined): {
  imageUrl: string | null
  videoEmbedUrl: string | null
} {
  if (!backgroundUrl?.trim()) {
    return { imageUrl: null, videoEmbedUrl: null }
  }
  const embed = parseVideoEmbedUrl(backgroundUrl)
  if (embed) {
    const suffix =
      embed.provider === 'youtube'
        ? '?autoplay=1&mute=1&controls=0&playsinline=1&rel=0'
        : '?background=1&autoplay=1&muted=1'
    return { imageUrl: null, videoEmbedUrl: `${embed.embedUrl}${suffix}` }
  }
  return { imageUrl: backgroundUrl, videoEmbedUrl: null }
}

export function ArchiveVideoBackdrop({ embedUrl }: { embedUrl: string }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '28%',
        marginBottom: '0.75rem',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#111',
      }}
    >
      <iframe
        title=""
        src={embedUrl}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 0,
        }}
        allow="autoplay; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>
  )
}
