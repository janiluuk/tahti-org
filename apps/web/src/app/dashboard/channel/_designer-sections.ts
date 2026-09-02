// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Single source of truth for the Channel Designer's focused-section view —
 * consumed by both the sidebar nav data (dashboard-nav.ts) and the designer
 * shell itself, so the two never drift out of sync. */

export type DesignerSectionId = 'visual' | 'header' | 'slideshow' | 'links' | 'player'

export type DesignerSectionSaveKind = 'gallery' | 'profile' | 'textLayer' | 'visual' | 'header'

export type DesignerSectionDefinition = {
  id: DesignerSectionId
  /** URL hash fragment (no #) — also used as the section's DOM id, for back-compat with old anchor links. */
  hash: string
  /** Sidebar + in-page section-list label. */
  navLabel: string
  /** "Now editing: {title}" + panel heading. */
  title: string
  description?: string
  saveKind: DesignerSectionSaveKind
}

export const DESIGNER_SECTIONS: DesignerSectionDefinition[] = [
  {
    id: 'visual',
    hash: 'channel-visual',
    navLabel: 'Visual style',
    title: 'Visual style',
    description: 'Brand accent, background visualizer, and color scheme.',
    saveKind: 'visual',
  },
  {
    id: 'header',
    hash: 'channel-header',
    navLabel: 'Header & backdrop',
    title: 'Header & backdrop',
    description: 'Identity, backdrop media, and what shows in your channel header.',
    saveKind: 'header',
  },
  {
    id: 'slideshow',
    hash: 'channel-slideshow',
    navLabel: 'Slideshow transitions',
    title: 'Slideshow transitions',
    description: 'Controls how gallery images move and change on your channel.',
    saveKind: 'visual',
  },
  {
    id: 'links',
    hash: 'channel-links',
    navLabel: 'Links',
    title: 'Links',
    description: 'Add the links shown in your channel banner.',
    saveKind: 'profile',
  },
  {
    id: 'player',
    hash: 'channel-text-overlay',
    navLabel: 'Player overlay text',
    title: 'Player overlay text',
    description: 'Add a stylized headline or tagline to your channel page.',
    saveKind: 'textLayer',
  },
]

/** Legacy hash aliases that used to point at now-merged/renamed sections. */
const LEGACY_HASH_ALIASES: Record<string, DesignerSectionId> = {
  'channel-media': 'header',
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
