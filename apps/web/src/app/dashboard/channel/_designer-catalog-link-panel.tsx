// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import type { DesignerSectionId } from './_designer-sections'

const CATALOG_LINKS: Record<
  Extract<DesignerSectionId, 'tracks' | 'collections' | 'releases'>,
  { href: string; label: string; blurb: string }
> = {
  tracks: {
    href: '/dashboard#sound',
    label: 'Open Sound',
    blurb: 'Pin featured tracks and manage your archive from Sound.',
  },
  collections: {
    href: '/dashboard/collections',
    label: 'Open Collections',
    blurb: 'Build playlists and collections that appear on your public pages.',
  },
  releases: {
    href: '/dashboard/releases',
    label: 'Open Releases',
    blurb: 'Publish releases that show on your artist and channel pages.',
  },
}

/** Lightweight designer sections that deep-link into existing Studio catalog tools. */
export function DesignerCatalogLinkPanel({
  section,
}: {
  section: Extract<DesignerSectionId, 'tracks' | 'collections' | 'releases'>
}) {
  const meta = CATALOG_LINKS[section]
  return (
    <div className="studio-field--block">
      <p className="studio-text-muted-sm studio-m-0 studio-mb-md">{meta.blurb}</p>
      <Link href={meta.href} className="ui-btn ui-btn--secondary ui-btn--sm">
        {meta.label} →
      </Link>
    </div>
  )
}
