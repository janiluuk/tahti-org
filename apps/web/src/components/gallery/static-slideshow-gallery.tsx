// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

export function StaticSlideshowGallery({ images }: { images: string[] }) {
  return (
    <div className="ch-slideshow" aria-label="Image gallery">
      {images.map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" />
      ))}
    </div>
  )
}
