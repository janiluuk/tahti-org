// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { ChannelGalleryMode } from '@tahti/shared'
import { ChannelGalleryView } from './channel-gallery'
import { usePlayer } from '@/contexts/player-context'

interface Props {
  itemId: string
  images: string[]
  galleryMode: ChannelGalleryMode
  audioReactive: boolean
}

export function SoundItemGallery({ itemId, images, galleryMode, audioReactive }: Props) {
  const { track, playing, analyser } = usePlayer()
  const isCurrent = track?.id === itemId

  if (galleryMode === 'NONE' || images.length === 0) {
    return (
      <div className="ch-sound-slideshow">
        {images.map((url) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={url} alt="" />
        ))}
      </div>
    )
  }

  return (
    <ChannelGalleryView
      mode={galleryMode}
      images={images}
      analyser={audioReactive && isCurrent && playing ? analyser : null}
    />
  )
}
