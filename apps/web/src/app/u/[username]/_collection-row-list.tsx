// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'

export interface CollectionRowItem {
  slug: string
  name: string
  type: string
  style: string
  description: string | null
  coverUrl?: string | null
  isFeatured?: boolean
  itemCount: number
  url: string
  rssUrl?: string
}

/** Shared row-list rendering for every Collection sub-group inside the
 * Releases tab (DJ Sets / Playlists / Collections) — same markup the flat
 * "Collections" section used before it was split into these sub-groups. */
export function CollectionRowList({
  items,
  canEdit = false,
}: {
  items: CollectionRowItem[]
  /** Owner or board admin — shows a per-row edit link straight into the studio. */
  canEdit?: boolean
}) {
  return (
    <ul className="prof-list prof-collection-list">
      {items.map((c) => (
        <li key={c.slug}>
          <div className="prof-collection-row">
            <Link href={c.url} className="prof-collection-row__clickarea">
              <div className="prof-collection-cover">
                {c.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.coverUrl} alt="" width={76} height={76} />
                ) : (
                  <span className="prof-collection-cover-ph" aria-hidden />
                )}
              </div>
              <div>
                <div className="prof-collection-title">{c.name}</div>
                <div className="prof-list-meta prof-list-meta--strong">
                  {c.itemCount} item{c.itemCount === 1 ? '' : 's'}
                  {c.isFeatured && ' · Featured'}
                </div>
                {c.description && (
                  <p className="prof-list-meta prof-list-meta--tight">{c.description}</p>
                )}
              </div>
            </Link>
            {canEdit && (
              <Link
                href={`/dashboard/collections/${c.slug}`}
                className="prof-row-edit-btn"
                aria-label={`Edit ${c.name}`}
                title="Edit"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M11.4 1.6a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1l-7.8 7.8-3.4.9.9-3.4 7.3-7.3z"
                  />
                </svg>
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
