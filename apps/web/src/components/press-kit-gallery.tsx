// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import type { PublicPressKitImage } from '@tahti/shared'

function GalleryModal({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: PublicPressKitImage[]
  index: number
  onClose: () => void
  onNavigate: (nextIndex: number) => void
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onNavigate((index - 1 + images.length) % images.length)
      else if (e.key === 'ArrowRight') onNavigate((index + 1) % images.length)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [index, images.length, onClose, onNavigate])

  const current = images[index]

  return (
    <div
      className="presskit-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={current.title ?? 'Press kit photo'}
      onClick={onClose}
    >
      <button
        type="button"
        className="presskit-lightbox__close"
        aria-label="Close"
        onClick={onClose}
      >
        ✕
      </button>

      {images.length > 1 && (
        <button
          type="button"
          className="presskit-lightbox__nav presskit-lightbox__nav--prev"
          aria-label="Previous photo"
          onClick={(e) => {
            e.stopPropagation()
            onNavigate((index - 1 + images.length) % images.length)
          }}
        >
          ‹
        </button>
      )}

      <figure className="presskit-lightbox__figure" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.imageUrl} alt={current.title ?? ''} className="presskit-lightbox__img" />
        {current.title && (
          <figcaption className="presskit-lightbox__caption">{current.title}</figcaption>
        )}
      </figure>

      {images.length > 1 && (
        <button
          type="button"
          className="presskit-lightbox__nav presskit-lightbox__nav--next"
          aria-label="Next photo"
          onClick={(e) => {
            e.stopPropagation()
            onNavigate((index + 1) % images.length)
          }}
        >
          ›
        </button>
      )}
    </div>
  )
}

export function PressKitGallery({ images }: { images: PublicPressKitImage[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (images.length === 0) return null

  return (
    <>
      <div className="prof-presskit-grid">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            className="prof-presskit-thumb"
            onClick={() => setOpenIndex(i)}
            aria-label={img.title ?? 'View photo'}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.imageUrl} alt={img.title ?? ''} loading="lazy" />
            {img.title && <span className="prof-presskit-thumb__caption">{img.title}</span>}
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <GalleryModal
          images={images}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      )}
    </>
  )
}
