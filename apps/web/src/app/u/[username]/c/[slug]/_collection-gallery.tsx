// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { ZoomableLightbox, type LightboxImage } from '@/components/zoomable-lightbox'

interface CollectionGalleryCtx {
  openAt: (url: string) => void
}

const Ctx = createContext<CollectionGalleryCtx | null>(null)

/** Wraps a collection page so its hero cover and item thumbnails — rendered
 * in separate trees (hero prop vs. page children, some inside their own
 * client components like ArchiveTrackRow) — can all open the same browsable,
 * zoomable lightbox at the right image. Look-up is by URL rather than a
 * pre-threaded index so callers don't need to know their position in the
 * flattened image list. */
export function CollectionGalleryProvider({
  images,
  children,
}: {
  images: LightboxImage[]
  children: ReactNode
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  function openAt(url: string) {
    const i = images.findIndex((img) => img.url === url)
    if (i >= 0) setOpenIndex(i)
  }

  return (
    <Ctx.Provider value={{ openAt }}>
      {children}
      {openIndex !== null && (
        <ZoomableLightbox
          images={images}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      )}
    </Ctx.Provider>
  )
}

/** Clickable cover thumbnail that opens the collection gallery at `url`.
 * Falls back to a plain (non-interactive) rendering outside a provider or
 * when there's no image, matching how the old <div>/<img> markup looked. */
export function CollectionCoverButton({
  url,
  className,
  imgWidth,
  imgHeight,
}: {
  url: string | null
  className: string
  imgWidth?: number
  imgHeight?: number
}) {
  const ctx = useContext(Ctx)

  if (!url) return <span className={`${className} prof-collection-cover-ph`} aria-hidden />

  if (!ctx) {
    return (
      <div className={className}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" width={imgWidth} height={imgHeight} />
      </div>
    )
  }

  return (
    <button
      type="button"
      className={`${className} prof-collection-cover--zoomable`}
      onClick={() => ctx.openAt(url)}
      aria-label="View cover art"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" width={imgWidth} height={imgHeight} />
    </button>
  )
}
