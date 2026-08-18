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

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const TAP_ZOOM = 2.5

function distance(a: React.Touch, b: React.Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function clampPan(x: number, y: number, zoom: number, containerW: number, containerH: number) {
  const maxX = (containerW * (zoom - 1)) / 2
  const maxY = (containerH * (zoom - 1)) / 2
  return {
    x: Math.min(Math.max(x, -maxX), maxX),
    y: Math.min(Math.max(y, -maxY), maxY),
  }
}

/** Wheel-zoom, double-click/double-tap-zoom, pinch-zoom, and drag-to-pan
 * around a single lightbox image. Resets whenever `src` changes (prev/next). */
function useZoomPan(src: string) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(
    null,
  )
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null)
  const lastTapRef = useRef(0)

  useEffect(() => {
    setZoom(MIN_ZOOM)
    setPan({ x: 0, y: 0 })
  }, [src])

  function applyZoom(nextZoom: number) {
    const z = Math.min(Math.max(nextZoom, MIN_ZOOM), MAX_ZOOM)
    setZoom(z)
    if (z <= MIN_ZOOM) {
      setPan({ x: 0, y: 0 })
      return
    }
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) setPan((p) => clampPan(p.x, p.y, z, rect.width, rect.height))
  }

  function toggleZoom() {
    applyZoom(zoom > MIN_ZOOM ? MIN_ZOOM : TAP_ZOOM)
  }

  function panBy(dx: number, dy: number, base: { x: number; y: number }) {
    const rect = containerRef.current?.getBoundingClientRect()
    setPan(clampPan(base.x + dx, base.y + dy, zoom, rect?.width ?? 0, rect?.height ?? 0))
  }

  const handlers = {
    onWheel(e: React.WheelEvent) {
      e.preventDefault()
      applyZoom(zoom * (1 - e.deltaY * 0.0015))
    },
    onDoubleClick() {
      toggleZoom()
    },
    onMouseDown(e: React.MouseEvent) {
      if (zoom <= MIN_ZOOM) return
      dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
    },
    onMouseMove(e: React.MouseEvent) {
      if (!dragRef.current) return
      panBy(e.clientX - dragRef.current.startX, e.clientY - dragRef.current.startY, {
        x: dragRef.current.panX,
        y: dragRef.current.panY,
      })
    },
    onMouseUp() {
      dragRef.current = null
    },
    onMouseLeave() {
      dragRef.current = null
    },
    onTouchStart(e: React.TouchEvent) {
      if (e.touches.length === 2) {
        pinchRef.current = { startDist: distance(e.touches[0]!, e.touches[1]!), startZoom: zoom }
        dragRef.current = null
        return
      }
      if (e.touches.length === 1) {
        const now = Date.now()
        if (now - lastTapRef.current < 300) toggleZoom()
        lastTapRef.current = now
        if (zoom > MIN_ZOOM) {
          const t = e.touches[0]!
          dragRef.current = { startX: t.clientX, startY: t.clientY, panX: pan.x, panY: pan.y }
        }
      }
    },
    onTouchMove(e: React.TouchEvent) {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        const d = distance(e.touches[0]!, e.touches[1]!)
        applyZoom(pinchRef.current.startZoom * (d / pinchRef.current.startDist))
        return
      }
      if (e.touches.length === 1 && dragRef.current) {
        e.preventDefault()
        const t = e.touches[0]!
        panBy(t.clientX - dragRef.current.startX, t.clientY - dragRef.current.startY, {
          x: dragRef.current.panX,
          y: dragRef.current.panY,
        })
      }
    },
    onTouchEnd(e: React.TouchEvent) {
      if (e.touches.length < 2) pinchRef.current = null
      if (e.touches.length === 0) dragRef.current = null
    },
  }

  return { containerRef, zoom, pan, handlers, resetZoom: () => applyZoom(MIN_ZOOM) }
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
  const { containerRef, zoom, pan, handlers, resetZoom } = useZoomPan(current.imageUrl)
  const zoomed = zoom > MIN_ZOOM

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && !zoomed)
        onNavigate((index - 1 + images.length) % images.length)
      else if (e.key === 'ArrowRight' && !zoomed) onNavigate((index + 1) % images.length)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [index, images.length, onClose, onNavigate, zoomed])

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
            resetZoom()
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
          <div
            ref={containerRef}
            className="presskit-lightbox__zoom-wrap"
            style={{ cursor: zoomed ? 'grab' : 'zoom-in' }}
            {...handlers}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={ref}
              src={current.imageUrl}
              alt={current.title ?? ''}
              className="presskit-lightbox__img"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
              draggable={false}
              onError={onError}
              onLoad={onLoad}
            />
          </div>
        )}
        {zoomed && (
          <button
            type="button"
            className="presskit-lightbox__zoom-badge"
            onClick={(e) => {
              e.stopPropagation()
              resetZoom()
            }}
          >
            {Math.round(zoom * 100)}% · Reset
          </button>
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
            resetZoom()
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
