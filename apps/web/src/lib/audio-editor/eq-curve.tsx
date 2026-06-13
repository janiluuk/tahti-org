// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useRef } from 'react'
import type { EditEqBand } from '@tahti/audio-edit'

const WIDTH = 600
const HEIGHT = 84
const MIN_FREQ = 20
const MAX_FREQ = 20000
const MAX_GAIN = 12

export const EQ_BAND_COLORS = ['var(--amber)', 'var(--green)', 'var(--purple)']
const BAND_COLORS = EQ_BAND_COLORS
const FREQ_MARKS = [80, 1200, 9000]

function freqToX(freq: number): number {
  const t = Math.log(freq / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ)
  return t * WIDTH
}

function xToFreq(x: number): number {
  const t = Math.min(1, Math.max(0, x / WIDTH))
  return MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, t)
}

function gainToY(gainDb: number): number {
  return HEIGHT / 2 - (gainDb / MAX_GAIN) * (HEIGHT / 2)
}

function yToGain(y: number): number {
  return ((HEIGHT / 2 - y) / (HEIGHT / 2)) * MAX_GAIN
}

function responseAt(freq: number, bands: EditEqBand[]): number {
  let total = 0
  for (const band of bands) {
    const octaves = Math.log2(freq / band.freq)
    const bandwidth = 1 / Math.max(0.1, band.q)
    total += band.gainDb / (1 + (octaves / bandwidth) ** 2)
  }
  return Math.max(-MAX_GAIN, Math.min(MAX_GAIN, total))
}

export function EqCurve({
  bands,
  onChange,
}: {
  bands: EditEqBand[]
  onChange: (index: number, next: { freq: number; gainDb: number }) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragIndex = useRef<number | null>(null)

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: ((clientX - rect.left) / rect.width) * WIDTH,
      y: ((clientY - rect.top) / rect.height) * HEIGHT,
    }
  }, [])

  const onPointerDown = (i: number) => (e: React.PointerEvent<SVGCircleElement>) => {
    dragIndex.current = i
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const i = dragIndex.current
    if (i === null) return
    const { x, y } = toLocal(e.clientX, e.clientY)
    const freq = Math.round(Math.min(MAX_FREQ, Math.max(MIN_FREQ, xToFreq(x))))
    const gainDb = Math.round(Math.min(MAX_GAIN, Math.max(-MAX_GAIN, yToGain(y))) * 2) / 2
    onChange(i, { freq, gainDb })
  }

  const onPointerUp = (e: React.PointerEvent<SVGElement>) => {
    if (dragIndex.current !== null && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    dragIndex.current = null
  }

  let curve = ''
  const steps = 60
  for (let s = 0; s <= steps; s++) {
    const x = (s / steps) * WIDTH
    const freq = xToFreq(x)
    const y = gainToY(responseAt(freq, bands))
    curve += s === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`
  }

  return (
    <svg
      ref={svgRef}
      className="pro-editor-eq-curve"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="img"
      aria-label="EQ response curve"
    >
      {[MAX_GAIN, 0, -MAX_GAIN].map((db) => (
        <line
          key={db}
          x1={0}
          x2={WIDTH}
          y1={gainToY(db)}
          y2={gainToY(db)}
          stroke="var(--bd)"
          strokeWidth={1}
        />
      ))}
      {FREQ_MARKS.map((f) => (
        <line
          key={f}
          x1={freqToX(f)}
          x2={freqToX(f)}
          y1={0}
          y2={HEIGHT}
          stroke="var(--bd)"
          strokeWidth={1}
          strokeDasharray="2,3"
        />
      ))}
      <path d={curve} fill="none" stroke="var(--cyan)" strokeWidth={2} />
      {bands.map((band, i) => (
        <circle
          key={i}
          cx={freqToX(band.freq)}
          cy={gainToY(band.gainDb)}
          r={6}
          fill={BAND_COLORS[i % BAND_COLORS.length]}
          stroke="var(--bg)"
          strokeWidth={2}
          style={{ cursor: 'grab', touchAction: 'none' }}
          onPointerDown={onPointerDown(i)}
          onPointerUp={onPointerUp}
        />
      ))}
    </svg>
  )
}
