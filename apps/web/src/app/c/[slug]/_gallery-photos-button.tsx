// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { ZoomableLightbox } from '@/components/zoomable-lightbox'

function IconPhotos() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="3" width="10" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2 9.5 5 6.8l2.2 2 2.3-2.6L12 9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="5.2" r="0.9" fill="currentColor" />
    </svg>
  )
}

/** Opens the artist's gallery images as a browsable, zoomable slideshow —
 * independent of the ambient decorative backdrop effect that also uses these
 * same images (ChannelGalleryView / ChannelSlideshow). */
export function GalleryPhotosButton({ images }: { images: string[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (images.length === 0) return null

  return (
    <>
      <button
        type="button"
        className="studio-top-nav__notif-btn"
        aria-label={`View photos (${images.length})`}
        title="Photos"
        onClick={() => setOpenIndex(0)}
      >
        <IconPhotos />
      </button>
      {openIndex !== null && (
        <ZoomableLightbox
          images={images.map((url) => ({ url }))}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      )}
    </>
  )
}
