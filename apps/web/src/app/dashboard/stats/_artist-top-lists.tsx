// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import NextLink from 'next/link'
import { ProgressBar } from '@tahti/ui'

export interface ArtistTopListEntry {
  archiveItemId: string
  listens: number
  title: string
  contentType: string
  genre: string | null
}

export interface ArtistTopListBucket {
  bucket: string
  entries: ArtistTopListEntry[]
}

const DIMENSIONS = [
  { value: 'type', label: 'By type' },
  { value: 'genre', label: 'By genre' },
] as const

const SORTS = [
  { value: 'desc', label: 'Most listened' },
  { value: 'asc', label: 'Least listened' },
] as const

function href(range: string, dimension: string, sort: string): string {
  return `/dashboard/stats?tab=top-lists&range=${range}&dimension=${dimension}&sort=${sort}`
}

function bucketLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, (first) => first.toUpperCase())
}

export function ArtistTopLists({
  buckets,
  range,
  dimension,
  sort,
}: {
  buckets: ArtistTopListBucket[]
  range: string
  dimension: string
  sort: string
}) {
  return (
    <section className="stats-top-lists" aria-labelledby="artist-top-lists-title">
      <div className="stats-panel stats-top-lists__intro">
        <div>
          <span className="stats-section-label">YOUR CONTENT</span>
          <h2 id="artist-top-lists-title">Top lists</h2>
          <p className="studio-text-muted-sm studio-m-0">
            Genuine listens, counted once per track per listener each day.
          </p>
        </div>
        <div className="stats-top-lists__filters">
          <div className="stats-range-tabs" role="group" aria-label="Top list grouping">
            {DIMENSIONS.map((option) => (
              <NextLink
                key={option.value}
                href={href(range, option.value, sort)}
                className={`stats-range-tab${dimension === option.value ? ' stats-range-tab--active' : ''}`}
              >
                {option.label}
              </NextLink>
            ))}
          </div>
          <div className="stats-range-tabs" role="group" aria-label="Top list order">
            {SORTS.map((option) => (
              <NextLink
                key={option.value}
                href={href(range, dimension, option.value)}
                className={`stats-range-tab${sort === option.value ? ' stats-range-tab--active' : ''}`}
              >
                {option.label}
              </NextLink>
            ))}
          </div>
        </div>
      </div>

      {buckets.length === 0 ? (
        <div className="studio-empty-card">
          <p className="studio-empty-card__text">No listens recorded for this period yet.</p>
          <p className="studio-empty-card__hint">
            Publish music or recordings to see your content rankings here.
          </p>
        </div>
      ) : (
        <div className="stats-top-lists__grid">
          {buckets.map((bucket) => {
            const max = Math.max(...bucket.entries.map((entry) => entry.listens), 1)
            return (
              <div key={bucket.bucket} className="stats-panel stats-top-lists__bucket">
                <h3>{bucketLabel(bucket.bucket)}</h3>
                {bucket.entries.map((entry, index) => (
                  <ProgressBar
                    key={entry.archiveItemId}
                    label={`#${index + 1} ${entry.title}`}
                    amount={`${entry.listens} ${entry.listens === 1 ? 'listen' : 'listens'}`}
                    percent={(entry.listens / max) * 100}
                    color="cyan"
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
