// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Single source of truth for the Channel Designer's focused-section view —
 * consumed by both the sidebar nav data (dashboard-nav.ts) and the designer
 * shell itself, so the two never drift out of sync. */

export type DesignerSectionId =
  | 'background'
  | 'header'
  | 'slideshow'
  | 'player'
  | 'links'
  | 'tracks'
  | 'collections'
  | 'releases'

export type DesignerSectionSaveKind =
  | 'gallery'
  | 'profile'
  | 'textLayer'
  | 'visual'
  | 'header'
  | 'none'

export type DesignerSectionDefinition = {
  id: DesignerSectionId
  /** URL hash fragment (no #) — also used as the section's DOM id, for back-compat with old anchor links. */
  hash: string
  /** Dropdown + sidebar label. */
  navLabel: string
  /** "Now editing: {title}" + panel heading. */
  title: string
  /** Shown only inside the help layer — not inline on the form. */
  help: string
  saveKind: DesignerSectionSaveKind
}

export const DESIGNER_SECTIONS: DesignerSectionDefinition[] = [
  {
    id: 'background',
    hash: 'channel-background',
    navLabel: 'Background',
    title: 'Background',
    help: 'Page and artist-box colors, brand accent swatches, and the optional audio-reactive background visualizer. Custom colors always apply — turn the visualizer off to keep a solid page wash.',
    saveKind: 'visual',
  },
  {
    id: 'header',
    hash: 'channel-header',
    navLabel: 'Header / backdrop',
    title: 'Header / backdrop',
    help: 'Banner style (gradient, solid, or video loop) and media. Drop images for the gallery or a video/image for the backdrop — videos automatically switch the header to video loop.',
    saveKind: 'header',
  },
  {
    id: 'slideshow',
    hash: 'channel-slideshow',
    navLabel: 'Slideshow',
    title: 'Slideshow',
    help: 'Transition style, interval, and autoplay for gallery images. Enable a gallery mode under Header / backdrop first.',
    saveKind: 'visual',
  },
  {
    id: 'player',
    hash: 'channel-text-overlay',
    navLabel: 'Player',
    title: 'Player',
    help: 'Stylized headline or tagline on the player stage (text overlay mode, copy, and alignment).',
    saveKind: 'textLayer',
  },
  {
    id: 'links',
    hash: 'channel-links',
    navLabel: 'Links',
    title: 'Links',
    help: 'Outbound links shown on your public channel banner.',
    saveKind: 'profile',
  },
  {
    id: 'tracks',
    hash: 'channel-tracks',
    navLabel: 'Featured tracks',
    title: 'Featured tracks',
    help: 'Pin and order tracks from Studio → Sound. The channel page lists published archive tracks automatically.',
    saveKind: 'none',
  },
  {
    id: 'collections',
    hash: 'channel-collections',
    navLabel: 'Collections',
    title: 'Collections',
    help: 'Create and feature playlists/collections from Studio → Collections.',
    saveKind: 'none',
  },
  {
    id: 'releases',
    hash: 'channel-releases',
    navLabel: 'Releases',
    title: 'Releases',
    help: 'Publish releases from Studio → Releases. They appear on your public artist and channel pages when live.',
    saveKind: 'none',
  },
]

/** Legacy hash aliases that used to point at now-merged/renamed sections. */
const LEGACY_HASH_ALIASES: Record<string, DesignerSectionId> = {
  'channel-media': 'header',
  'channel-visual': 'background',
}

const HASH_TO_SECTION: Record<string, DesignerSectionId> = Object.fromEntries(
  DESIGNER_SECTIONS.map((s) => [s.hash, s.id]),
)

export function resolveDesignerSection(rawHash: string): DesignerSectionId {
  const key = rawHash.replace(/^#/, '').trim()
  return HASH_TO_SECTION[key] ?? LEGACY_HASH_ALIASES[key] ?? DESIGNER_SECTIONS[0]!.id
}

export function designerSectionById(id: DesignerSectionId): DesignerSectionDefinition {
  return DESIGNER_SECTIONS.find((s) => s.id === id) ?? DESIGNER_SECTIONS[0]!
}
