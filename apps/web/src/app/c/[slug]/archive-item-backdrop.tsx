// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { parseVideoEmbedUrl, cssBackdropUrlValue, isAllowedBackdropUrl } from '@tahti/shared'

export function resolveArchiveBackground(backgroundUrl: string | null | undefined): {
  imageUrl: string | null
  videoEmbedUrl: string | null
  cssImageUrl: string | null
} {
  if (!backgroundUrl?.trim() || !isAllowedBackdropUrl(backgroundUrl)) {
    return { imageUrl: null, videoEmbedUrl: null, cssImageUrl: null }
  }
  const embed = parseVideoEmbedUrl(backgroundUrl)
  if (embed) {
    const suffix =
      embed.provider === 'youtube'
        ? '?autoplay=1&mute=1&controls=0&playsinline=1&rel=0'
        : '?background=1&autoplay=1&muted=1'
    return { imageUrl: null, videoEmbedUrl: `${embed.embedUrl}${suffix}`, cssImageUrl: null }
  }
  const cssImageUrl = cssBackdropUrlValue(backgroundUrl)
  return {
    imageUrl: cssImageUrl ? backgroundUrl.trim() : null,
    videoEmbedUrl: null,
    cssImageUrl,
  }
}

export function ArchiveVideoBackdrop({ embedUrl }: { embedUrl: string }) {
  return (
    <div className="ch-video-backdrop">
      <iframe
        title=""
        src={embedUrl}
        allow="autoplay; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>
  )
}
