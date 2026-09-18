// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'
import { ButtonIcon, Button } from '@tahti/ui'

const VIEWPORT_MAX_DIMENSION = 320
const OUTPUT_MAX_DIMENSION = 1200

interface Props {
  imageSrc: string
  onCancel: () => void
  onCropped: (blob: Blob) => void
  /** Prefer PNG so alpha survives (logos / transparent avatars). Default JPEG. */
  outputMime?: 'image/jpeg' | 'image/png'
  /** width / height of the crop window. 1 = square avatar, >1 = wide banner. Default 1. */
  aspectRatio?: number
  /** 'circle' masks the viewport round (avatars); 'rect' keeps square corners (backdrops). */
  shape?: 'circle' | 'rect'
  title?: string
  confirmLabel?: string
}

/** Pan/zoom crop tool — works on both uploaded files and proxied URLs, for
 * either a circular avatar (aspectRatio 1, shape 'circle') or a wide
 * rectangular backdrop banner (aspectRatio > 1, shape 'rect'). */
export function ImageCropModal({
  imageSrc,
  onCancel,
  onCropped,
  outputMime = 'image/jpeg',
  aspectRatio = 1,
  shape = 'circle',
  title = 'Position your avatar',
  confirmLabel = 'Use this image',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)

  const viewportW = aspectRatio >= 1 ? VIEWPORT_MAX_DIMENSION : VIEWPORT_MAX_DIMENSION * aspectRatio
  const viewportH = aspectRatio >= 1 ? VIEWPORT_MAX_DIMENSION / aspectRatio : VIEWPORT_MAX_DIMENSION
  const outputW = aspectRatio >= 1 ? OUTPUT_MAX_DIMENSION : OUTPUT_MAX_DIMENSION * aspectRatio
  const outputH = aspectRatio >= 1 ? OUTPUT_MAX_DIMENSION / aspectRatio : OUTPUT_MAX_DIMENSION

  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const img = new Image()
    if (!imageSrc.startsWith('blob:')) img.crossOrigin = 'use-credentials'
    img.onload = () => {
      imgRef.current = img
      setOffset({ x: 0, y: 0 })
      setZoom(1)
      setReady(true)
    }
    img.onerror = () => setError('Could not load that image')
    img.src = imageSrc
    return () => {
      imgRef.current = null
    }
  }, [imageSrc])

  function baseScale(img: HTMLImageElement): number {
    return Math.max(viewportW / img.naturalWidth, viewportH / img.naturalHeight)
  }

  function clampOffset(img: HTMLImageElement, z: number, x: number, y: number) {
    const scale = baseScale(img) * z
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    const minX = viewportW - w
    const minY = viewportH - h
    return { x: Math.min(0, Math.max(minX, x)), y: Math.min(0, Math.max(minY, y)) }
  }

  function draw() {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const scale = baseScale(img) * zoom
    ctx.clearRect(0, 0, viewportW, viewportH)
    ctx.drawImage(img, offset.x, offset.y, img.naturalWidth * scale, img.naturalHeight * scale)
  }

  // viewportW/viewportH/baseScale are derived from the aspectRatio prop, fixed for the modal's lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [ready, zoom, offset])

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    dragRef.current = { x: e.clientX, y: e.clientY, offsetX: offset.x, offsetY: offset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    const img = imgRef.current
    if (!drag || !img) return
    const next = clampOffset(
      img,
      zoom,
      drag.offsetX + (e.clientX - drag.x),
      drag.offsetY + (e.clientY - drag.y),
    )
    setOffset(next)
  }

  function onPointerUp() {
    dragRef.current = null
  }

  function onZoomChange(z: number) {
    const img = imgRef.current
    if (!img) return
    setZoom(z)
    setOffset((prev) => clampOffset(img, z, prev.x, prev.y))
  }

  function handleSave() {
    const img = imgRef.current
    if (!img) return
    setSaving(true)
    const out = document.createElement('canvas')
    out.width = outputW
    out.height = outputH
    const ctx = out.getContext('2d')
    if (!ctx) {
      setSaving(false)
      return
    }
    const ratio = outputW / viewportW
    const scale = baseScale(img) * zoom * ratio
    // Clear first so PNG/WebP exports keep transparency outside the drawn pixels.
    ctx.clearRect(0, 0, outputW, outputH)
    ctx.drawImage(
      img,
      offset.x * ratio,
      offset.y * ratio,
      img.naturalWidth * scale,
      img.naturalHeight * scale,
    )
    const mime = outputMime
    out.toBlob(
      (blob) => {
        setSaving(false)
        if (blob) onCropped(blob)
        else setError('Could not export image')
      },
      mime,
      mime === 'image/jpeg' ? 0.92 : undefined,
    )
  }

  return (
    <div className="image-crop-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="image-crop-modal">
        <h3 className="image-crop-modal__title">{title}</h3>
        {error ? (
          <p className="studio-notice studio-notice--error">{error}</p>
        ) : (
          <>
            <div
              className={`image-crop-modal__viewport image-crop-modal__viewport--${shape}`}
              style={{ width: viewportW, height: viewportH }}
            >
              <canvas
                ref={canvasRef}
                width={viewportW}
                height={viewportH}
                className="image-crop-modal__canvas"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              />
            </div>
            <label className="image-crop-modal__zoom">
              <span className="studio-label">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                disabled={!ready}
                onChange={(e) => onZoomChange(Number(e.target.value))}
              />
            </label>
          </>
        )}
        <div className="studio-actions">
          <Button onClick={onCancel} disabled={saving} variant="ghost">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!ready || saving || Boolean(error)}
            variant="primary"
          >
            <ButtonIcon name="check" />
            {saving ? 'Saving…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
