// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// M31 PLAT-070: extract dominant 5-color palette from a cover art image URL.
// Uses node-vibrant v4 (named exports, property accessors not getRgb()).
// Failure is silent — callers must not await this on the critical path.

import type { ColorScheme } from '@tahti/shared'

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export async function extractPalette(imageUrl: string): Promise<ColorScheme | null> {
  try {
    const { Vibrant } = await import('node-vibrant/node')
    const palette = await Vibrant.from(imageUrl).getPalette()

    const bg = palette.DarkMuted ?? palette.Muted ?? palette.DarkVibrant
    const accent = palette.Vibrant ?? palette.LightVibrant ?? palette.LightMuted
    const highlight = palette.LightVibrant ?? palette.Vibrant ?? palette.LightMuted
    const muted = palette.Muted ?? palette.DarkMuted ?? palette.DarkVibrant

    if (!bg || !accent) return null

    const bgLum = luminance(bg.r, bg.g, bg.b)
    const textHex = bgLum < 128 ? '#f1f5f9' : '#0f172a'

    const textSwatch = palette.LightMuted ?? palette.LightVibrant
    const textHexFinal = textSwatch ? textSwatch.hex : textHex

    return {
      bg: bg.hex,
      accent: accent.hex,
      text: textHexFinal,
      muted: (muted ?? bg).hex,
      highlight: (highlight ?? accent).hex,
    }
  } catch {
    return null
  }
}
