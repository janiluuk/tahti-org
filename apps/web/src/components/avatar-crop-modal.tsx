// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'
import { ButtonIcon } from '@tahti/ui'

const VIEWPORT_SIZE = 280
const OUTPUT_SIZE = 512

interface Props {
  imageSrc: string
  onCancel: () => void
  onCropped: (blob: Blob) => void
}

/** Pan/zoom crop tool for avatar images — works on both uploaded files and proxied URLs. */
export function AvatarCropModal({ imageSrc, onCancel, onCropped }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)

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
    return Math.max(VIEWPORT_SIZE / img.naturalWidth, VIEWPORT_SIZE / img.naturalHeight)
  }

  function clampOffset(img: HTMLImageElement, z: number, x: number, y: number) {
    const scale = baseScale(img) * z
    const w = img.naturalWidth * scale
    const h = img.naturalHeight * scale
    const minX = VIEWPORT_SIZE - w
    const minY = VIEWPORT_SIZE - h
    return { x: Math.min(0, Math.max(minX, x)), y: Math.min(0, Math.max(minY, y)) }
  }

  function draw() {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const scale = baseScale(img) * zoom
    ctx.clearRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE)
    ctx.drawImage(img, offset.x, offset.y, img.naturalWidth * scale, img.naturalHeight * scale)
  }

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
    out.width = OUTPUT_SIZE
    out.height = OUTPUT_SIZE
    const ctx = out.getContext('2d')
    if (!ctx) {
      setSaving(false)
      return
    }
    const ratio = OUTPUT_SIZE / VIEWPORT_SIZE
    const scale = baseScale(img) * zoom * ratio
    ctx.drawImage(
      img,
      offset.x * ratio,
      offset.y * ratio,
      img.naturalWidth * scale,
      img.naturalHeight * scale,
    )
    out.toBlob(
      (blob) => {
        setSaving(false)
        if (blob) onCropped(blob)
        else setError('Could not export image')
      },
      'image/jpeg',
      0.92,
    )
  }

  return (
    <div className="avatar-crop-overlay" role="dialog" aria-modal="true" aria-label="Crop avatar">
      <div className="avatar-crop-modal">
        <h3 className="avatar-crop-modal__title">Position your avatar</h3>
        {error ? (
          <p className="studio-notice studio-notice--error">{error}</p>
        ) : (
          <>
            <div className="avatar-crop-modal__viewport">
              <canvas
                ref={canvasRef}
                width={VIEWPORT_SIZE}
                height={VIEWPORT_SIZE}
                className="avatar-crop-modal__canvas"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              />
            </div>
            <label className="avatar-crop-modal__zoom">
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
          <button
            type="button"
            className="ui-btn ui-btn--ghost"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--primary"
            onClick={handleSave}
            disabled={!ready || saving || Boolean(error)}
          >
            <ButtonIcon name="check" />
            {saving ? 'Saving…' : 'Use this avatar'}
          </button>
        </div>
      </div>
    </div>
  )
}
