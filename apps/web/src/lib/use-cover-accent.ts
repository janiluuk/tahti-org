// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'

export interface CoverAccent {
  accent: string
  highlight: string
}

const SAMPLE_SIZE = 24
const MIN_ALPHA = 200

const cache = new Map<string, CoverAccent | null>()
const pending = new Map<string, Promise<CoverAccent | null>>()

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  switch (max) {
    case r:
      h = ((g - b) / d) % 6
      break
    case g:
      h = (b - r) / d + 2
      break
    default:
      h = (r - g) / d + 4
  }
  h *= 60
  if (h < 0) h += 360
  return [h, s, l]
}

function hslToCss(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`
}

/** Averages the visible pixels of a downscaled cover into one accent color,
 * then derives a lighter/more saturated highlight from the same hue. */
function extractFromImage(img: HTMLImageElement): CoverAccent | null {
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_SIZE
  canvas.height = SAMPLE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
  // Throws on a CORS-tainted canvas (cover host without CORS headers) —
  // caught by the caller, which just skips the glow for that track.
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < MIN_ALPHA) continue
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    count++
  }
  if (count === 0) return null
  const [h, s, l] = rgbToHsl(r / count, g / count, b / count)
  return {
    accent: hslToCss(h, Math.min(0.85, Math.max(s, 0.35)), Math.min(0.6, Math.max(l, 0.3))),
    highlight: hslToCss(h, Math.min(0.9, Math.max(s, 0.45)), Math.min(0.8, l + 0.18)),
  }
}

function loadAccent(url: string): Promise<CoverAccent | null> {
  const existing = pending.get(url)
  if (existing) return existing
  const promise = new Promise<CoverAccent | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        resolve(extractFromImage(img))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
  pending.set(url, promise)
  promise.then((result) => {
    cache.set(url, result)
    pending.delete(url)
  })
  return promise
}

/** Derives an ambient accent/highlight pair from a cover image for the
 * per-row glow. Individual tracks have no server-extracted palette (only
 * Collections do — see palette-extract.ts) so this samples the already-
 * loaded cover client-side instead; results are cached per URL for the
 * session. Returns null (no glow) while loading, on a CORS-tainted image,
 * or when there's no cover at all. */
export function useCoverAccent(url: string | null | undefined): CoverAccent | null {
  const [accent, setAccent] = useState<CoverAccent | null>(() =>
    url ? (cache.get(url) ?? null) : null,
  )

  useEffect(() => {
    if (!url) {
      setAccent(null)
      return
    }
    const cached = cache.get(url)
    if (cached !== undefined) {
      setAccent(cached)
      return
    }
    let cancelled = false
    loadAccent(url).then((result) => {
      if (!cancelled) setAccent(result)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  return accent
}
