// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Deterministic two-tone gradient covers for tracks with no uploaded artwork —
 * used by the Tahti Selects seed/backfill scripts, not exposed to artists. */
const PALETTES: [string, string][] = [
  ['#f0a500', '#7c4dff'],
  ['#00bcd4', '#7c4dff'],
  ['#00e676', '#00bcd4'],
  ['#ff6b6b', '#f0a500'],
  ['#7c4dff', '#ff6b6b'],
  ['#00bcd4', '#00e676'],
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/** A 500×500 SVG cover — gradient background keyed off the title, title +
 * subtitle text overlaid. Renders directly via <img>, no rasterization needed. */
export function generateCoverArtSvg(title: string, subtitle: string): string {
  const [c1, c2] = PALETTES[hashString(title) % PALETTES.length]!
  const t = escapeXml(truncate(title, 34))
  const s = escapeXml(truncate(subtitle, 34))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="500" height="500" fill="url(#g)"/>
  <circle cx="250" cy="190" r="90" fill="rgba(255,255,255,0.1)"/>
  <circle cx="250" cy="190" r="45" fill="rgba(255,255,255,0.14)"/>
  <text x="36" y="388" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="600" fill="#fff">${t}</text>
  <text x="36" y="420" font-family="Helvetica, Arial, sans-serif" font-size="19" fill="rgba(255,255,255,0.78)">${s}</text>
</svg>`
}

// ---------------------------------------------------------------------------
// Genre-motif art — richer generative covers/banners keyed by genre + an
// artist's own brand accent colors (BRAND_ACCENT_PRESETS), so a placeholder
// catalog reads as "designed" rather than a flat two-tone gradient. Still no
// external assets: everything is inline SVG shapes/filters, deterministic
// from a hash seed so re-running a seed script reproduces the same art.
// ---------------------------------------------------------------------------

/** Small deterministic PRNG (mulberry32) seeded from a string hash — used for
 * particle/shape placement so each cover is reproducible from its title. */
function seededRng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${alpha})`
}

export type AlbumArtGenre =
  | 'Ambient'
  | 'Electronic'
  | 'Downtempo'
  | 'Lo-fi'
  | 'Synthwave'
  | 'Experimental'

export interface AlbumArtColors {
  bg: string
  accent: string
  highlight: string
}

const DEFAULT_ART_COLORS: AlbumArtColors = {
  bg: '#0A0E1C',
  accent: '#22D3EE',
  highlight: '#A78BFA',
}

/** Motif body only (no background/text) — shared by the square cover and the
 * widescreen banner, each of which wraps this in its own frame + typography. */
function motifBody(
  genre: AlbumArtGenre | undefined,
  seed: number,
  colors: AlbumArtColors,
  w: number,
  h: number,
): string {
  const rng = seededRng(seed)
  const { accent, highlight } = colors
  const cx = w / 2
  const cy = h / 2

  switch (genre) {
    case 'Ambient': {
      let out = ''
      for (let i = 0; i < 4; i++) {
        const r = h * (0.22 + rng() * 0.2)
        const x = w * (0.15 + rng() * 0.7)
        const y = h * (0.15 + rng() * 0.7)
        const color = i % 2 === 0 ? accent : highlight
        out += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" fill="${rgba(color, 0.4)}" filter="url(#blur)"/>`
      }
      return out
    }
    case 'Electronic': {
      const step = w / 12
      let grid = ''
      for (let i = 1; i < 12; i++) {
        grid += `<line x1="${(i * step).toFixed(0)}" y1="0" x2="${(i * step).toFixed(0)}" y2="${h}" stroke="${rgba(accent, 0.12)}" stroke-width="1"/>`
      }
      let squares = ''
      for (let i = 0; i < 9; i++) {
        const s = step * (0.5 + rng() * 1.3)
        const x = rng() * (w - s)
        const y = rng() * (h - s)
        const color = rng() > 0.5 ? accent : highlight
        squares += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${s.toFixed(0)}" height="${s.toFixed(0)}" fill="${rgba(color, 0.15 + rng() * 0.15)}"/>`
      }
      return grid + squares
    }
    case 'Downtempo': {
      let out = ''
      const bands = 5
      for (let b = 0; b < bands; b++) {
        const baseY = h * ((b + 1) / (bands + 1))
        const amp = h * 0.05
        const color = b % 2 === 0 ? accent : highlight
        let d = `M 0 ${baseY.toFixed(0)} `
        const steps = 8
        for (let i = 1; i <= steps; i++) {
          const x = (w / steps) * i
          const y = baseY + Math.sin(i + b + rng() * 0.6) * amp
          d += `L ${x.toFixed(0)} ${y.toFixed(0)} `
        }
        d += `L ${w} ${h} L 0 ${h} Z`
        out += `<path d="${d}" fill="${rgba(color, 0.1 + b * 0.03)}"/>`
      }
      return out
    }
    case 'Lo-fi': {
      let dots = `<circle cx="${cx}" cy="${cy}" r="${h * 0.4}" fill="none" stroke="${rgba(accent, 0.25)}" stroke-width="${h * 0.012}"/>`
      dots += `<circle cx="${cx}" cy="${cy}" r="${h * 0.06}" fill="${rgba(highlight, 0.5)}"/>`
      for (let i = 0; i < 60; i++) {
        const x = rng() * w
        const y = rng() * h
        dots += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(rng() * 1.6).toFixed(1)}" fill="${rgba('#ffffff', 0.08 + rng() * 0.1)}"/>`
      }
      return dots
    }
    case 'Synthwave': {
      const horizon = h * 0.62
      let sunBands = `<circle cx="${cx}" cy="${horizon - h * 0.05}" r="${h * 0.22}" fill="${rgba(accent, 0.85)}" clip-path="url(#sunclip)"/>`
      for (let i = 0; i < 5; i++) {
        sunBands += `<rect x="${cx - h * 0.22}" y="${horizon - h * 0.05 - h * 0.22 + i * (h * 0.045) + h * 0.1}" width="${h * 0.44}" height="${h * 0.02}" fill="${rgba(colors.bg, 0.9)}"/>`
      }
      let grid = `<line x1="0" y1="${horizon}" x2="${w}" y2="${horizon}" stroke="${rgba(highlight, 0.5)}" stroke-width="2"/>`
      for (let i = 1; i < 10; i++) {
        const t = i / 10
        const x = cx + (t - 0.5) * w * 1.6
        grid += `<line x1="${cx}" y1="${horizon}" x2="${x.toFixed(0)}" y2="${h}" stroke="${rgba(highlight, 0.3)}" stroke-width="1"/>`
      }
      for (let i = 1; i < 6; i++) {
        const y = horizon + (h - horizon) * (i / 6) * (i / 6)
        grid += `<line x1="0" y1="${y.toFixed(0)}" x2="${w}" y2="${y.toFixed(0)}" stroke="${rgba(highlight, 0.25)}" stroke-width="1"/>`
      }
      return sunBands + grid
    }
    case 'Experimental':
    default: {
      let out = ''
      for (let i = 0; i < 10; i++) {
        const x = rng() * w
        const y = rng() * h
        const s = h * (0.06 + rng() * 0.16)
        const rot = rng() * 360
        const color = rng() > 0.5 ? accent : highlight
        const pts = [
          [0, -s],
          [s * 0.87, s * 0.5],
          [-s * 0.87, s * 0.5],
        ]
          .map(([px, py]) => `${(x + px!).toFixed(0)},${(y + py!).toFixed(0)}`)
          .join(' ')
        out += `<polygon points="${pts}" fill="${rgba(color, 0.14 + rng() * 0.14)}" transform="rotate(${rot.toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`
      }
      return out
    }
  }
}

/** Square (500×500) album/archive cover — genre-motif art behind title +
 * subtitle, colored from the artist's own brand accent/highlight so a
 * placeholder catalog reads as art-directed rather than randomly gradiented. */
export function generateAlbumArtSvg(
  title: string,
  subtitle: string,
  opts: { genre?: string; colors?: AlbumArtColors } = {},
): string {
  const colors = opts.colors ?? DEFAULT_ART_COLORS
  const genre = (opts.genre as AlbumArtGenre | undefined) ?? undefined
  const seed = hashString(`${title}::${subtitle}`)
  const size = 500
  const t = escapeXml(truncate(title, 34))
  const s = escapeXml(truncate(subtitle, 34))

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colors.bg}"/>
      <stop offset="100%" stop-color="${rgba(colors.accent, 0.18)}"/>
    </linearGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${colors.bg}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${colors.bg}" stop-opacity="0.92"/>
    </linearGradient>
    <clipPath id="sunclip"><rect x="0" y="0" width="${size}" height="${size * 0.62}"/></clipPath>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${size * 0.035}"/>
    </filter>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  ${motifBody(genre, seed, colors, size, size)}
  <rect x="0" y="${size * 0.66}" width="${size}" height="${size * 0.34}" fill="url(#scrim)"/>
  <text x="36" y="${size * 0.78}" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="600" fill="#fff">${t}</text>
  <text x="36" y="${size * 0.84}" font-family="Helvetica, Arial, sans-serif" font-size="19" fill="rgba(255,255,255,0.78)">${s}</text>
</svg>`
}

/** Widescreen (1600×480) channel backdrop banner — same motif language as
 * generateAlbumArtSvg (genre + brand colors), no title baked in since the
 * page already overlays the artist's own name/avatar on top of it. */
export function generateChannelBannerSvg(
  seedText: string,
  opts: { genre?: string; colors?: AlbumArtColors } = {},
): string {
  const colors = opts.colors ?? DEFAULT_ART_COLORS
  const genre = (opts.genre as AlbumArtGenre | undefined) ?? undefined
  const seed = hashString(`banner::${seedText}`)
  const w = 1600
  const h = 480

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colors.bg}"/>
      <stop offset="100%" stop-color="${rgba(colors.accent, 0.16)}"/>
    </linearGradient>
    <clipPath id="sunclip"><rect x="0" y="0" width="${w}" height="${h * 0.62}"/></clipPath>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${h * 0.035}"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  ${motifBody(genre, seed, colors, w, h)}
</svg>`
}

function initialsFor(name: string): string {
  const parts = name
    .replace(/\[.*?\]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
}

/** A 500×500 SVG avatar — gradient background keyed off the seed, large
 * centered initials. Square + centered so it survives circular avatar
 * cropping, unlike generateCoverArtSvg's corner-text layout. */
export function generateAvatarSvg(seed: string, displayName: string): string {
  const [c1, c2] = PALETTES[hashString(seed) % PALETTES.length]!
  const initials = escapeXml(initialsFor(displayName))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="500" height="500" fill="url(#g)"/>
  <circle cx="250" cy="250" r="220" fill="rgba(255,255,255,0.06)"/>
  <text x="250" y="278" font-family="Helvetica, Arial, sans-serif" font-size="180" font-weight="700" fill="#fff" text-anchor="middle">${initials}</text>
</svg>`
}
