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
