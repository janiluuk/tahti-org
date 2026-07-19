// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import type { PublicPressKitImage } from '@tahti/shared'

/** Tracks whether an <img> failed to load — including the failure having
 * already happened by the time this mounts or re-targets. The src is present
 * in the server-rendered HTML (or set directly, for the lightbox reusing one
 * <img> across images), so the browser can start — and finish, if it's a fast
 * same-machine failure like an ORB block — loading it before React commits
 * and attaches onError/onLoad; without the `src`-keyed re-check via the ref,
 * that race silently drops the failure. */
function useBrokenImage(src: string) {
  const ref = useRef<HTMLImageElement>(null)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    setBroken(false)
    const el = ref.current
    if (el?.complete && el.naturalWidth === 0) setBroken(true)
  }, [src])

  function onError() {
    setBroken(true)
  }
  function onLoad(e: SyntheticEvent<HTMLImageElement>) {
    if (e.currentTarget.naturalWidth === 0) setBroken(true)
  }

  return { ref, broken, onError, onLoad }
}

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
  const current = images[index]
  const { ref, broken, onError, onLoad } = useBrokenImage(current.imageUrl)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onNavigate((index - 1 + images.length) % images.length)
      else if (e.key === 'ArrowRight') onNavigate((index + 1) % images.length)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [index, images.length, onClose, onNavigate])

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
        {broken ? (
          <p className="presskit-lightbox__error">This photo couldn&rsquo;t be loaded.</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={ref}
            src={current.imageUrl}
            alt={current.title ?? ''}
            className="presskit-lightbox__img"
            onError={onError}
            onLoad={onLoad}
          />
        )}
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

function Thumb({ img, onOpen }: { img: PublicPressKitImage; onOpen: () => void }) {
  const { ref, broken, onError, onLoad } = useBrokenImage(img.imageUrl)

  // A thumbnail whose object is gone or unreachable is just noise in a promo
  // gallery — drop it silently rather than show the browser's broken-image icon.
  if (broken) return null

  return (
    <button
      type="button"
      className="prof-presskit-thumb"
      onClick={onOpen}
      aria-label={img.title ?? 'View photo'}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={img.imageUrl}
        alt={img.title ?? ''}
        loading="lazy"
        onError={onError}
        onLoad={onLoad}
      />
      {img.title && <span className="prof-presskit-thumb__caption">{img.title}</span>}
    </button>
  )
}

export function PressKitGallery({ images }: { images: PublicPressKitImage[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (images.length === 0) return null

  return (
    <>
      <div className="prof-presskit-grid">
        {images.map((img, i) => (
          <Thumb key={img.id} img={img} onOpen={() => setOpenIndex(i)} />
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
