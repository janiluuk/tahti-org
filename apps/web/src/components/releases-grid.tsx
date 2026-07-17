// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'

const DEFAULT_VISIBLE = 8

export interface ReleaseGridItem {
  id: string
  title: string
  type: string
  releaseDate: string
  artworkUrl: string | null
  smartLinkSlug: string
}

export function ReleasesGrid({ releases }: { releases: ReleaseGridItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? releases : releases.slice(0, DEFAULT_VISIBLE)
  const hasMore = releases.length > DEFAULT_VISIBLE

  return (
    <>
      <ul className="prof-release-grid">
        {visible.map((r) => {
          const year = new Date(r.releaseDate).getFullYear()
          return (
            <li id={`release-${r.id}`} key={r.id} className="prof-release-card">
              <Link href={`/r/${r.smartLinkSlug}`} className="prof-release-card-art">
                {r.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.artworkUrl} alt={r.title} />
                ) : null}
              </Link>
              <Link href={`/r/${r.smartLinkSlug}`} className="prof-release-card-title">
                {r.title}
              </Link>
              <div className="prof-release-card-meta">
                {r.type} · {year}
              </div>
            </li>
          )
        })}
      </ul>
      {hasMore && (
        <button
          type="button"
          className="prof-release-expand"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show less' : `Show all ${releases.length} releases`}
        </button>
      )}
    </>
  )
}
