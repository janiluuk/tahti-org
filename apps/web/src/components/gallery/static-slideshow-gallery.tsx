// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

export function StaticSlideshowGallery({ images }: { images: string[] }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.75rem',
        overflowX: 'auto',
        marginBottom: '1.5rem',
        paddingBottom: '0.25rem',
      }}
      aria-label="Image gallery"
    >
      {images.map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          style={{
            height: 240,
            width: 'auto',
            borderRadius: 8,
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}
