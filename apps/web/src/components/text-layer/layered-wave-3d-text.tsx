// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use client'

/** Inspired by freefrontend.com — Interactive 3D Layered Text Wave Effect */
import { useCallback, useEffect, useRef } from 'react'
import type { ChannelTextLayerAlignment } from '@tahti/shared'
import './text-layer.css'

const LAYER_OFFSETS = [
  { z: 0, scale: 1, opacity: 1 },
  { z: -8, scale: 0.98, opacity: 0.55 },
  { z: -16, scale: 0.96, opacity: 0.4 },
  { z: -24, scale: 0.94, opacity: 0.28 },
]

export function LayeredWave3DText({
  text,
  align,
}: {
  text: string
  align: ChannelTextLayerAlignment
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const stackRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: 0, y: 0 })
  const current = useRef({ x: 0, y: 0 })
  const frameRef = useRef(0)

  const alignClass =
    align === 'LEFT'
      ? 'text-layer--left'
      : align === 'RIGHT'
        ? 'text-layer--right'
        : 'text-layer--center'

  const onMove = useCallback((e: React.PointerEvent) => {
    const el = hostRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    target.current.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2
    target.current.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2
  }, [])

  const onLeave = useCallback(() => {
    target.current.x = 0
    target.current.y = 0
  }, [])

  useEffect(() => {
    const stack = stackRef.current
    if (!stack) return

    const layers = stack.querySelectorAll<HTMLElement>('[data-wave-layer]')

    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * 0.08
      current.current.y += (target.current.y - current.current.y) * 0.08

      layers.forEach((layer, i) => {
        const depth = i + 1
        const ox = current.current.x * depth * 6
        const oy = current.current.y * depth * 4
        layer.style.transform = `translate3d(${ox}px, ${oy}px, ${LAYER_OFFSETS[i]?.z ?? 0}px) scale(${LAYER_OFFSETS[i]?.scale ?? 1})`
      })

      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [text])

  return (
    <div
      ref={hostRef}
      className={`text-layer text-layer--layered-wave ${alignClass}`}
      aria-label="3D layered wave text"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <div ref={stackRef} className="text-layer__wave-stack">
        {LAYER_OFFSETS.map((_, i) => (
          <p
            key={i}
            data-wave-layer
            className={`text-layer__wave-layer text-layer__wave-layer--${i}`}
            aria-hidden={i > 0}
          >
            {text}
          </p>
        ))}
      </div>
    </div>
  )
}
