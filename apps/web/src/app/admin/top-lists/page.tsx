// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { ProgressBar } from '@tahti/ui'

interface TopListEntry {
  archiveItemId: string
  listens: number
  title: string
  artistName: string
  channelSlug: string
  contentType: string
  genre: string | null
}

interface TopListBucket {
  bucket: string
  entries: TopListEntry[]
}

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

const PERIODS = [
  { value: 'month', label: 'Month' },
  { value: 'half_year', label: 'Half year' },
  { value: 'all_time', label: 'All time' },
] as const

const DIMENSIONS = [
  { value: 'type', label: 'By type' },
  { value: 'genre', label: 'By genre' },
] as const

const SORTS = [
  { value: 'desc', label: 'Most listened' },
  { value: 'asc', label: 'Least listened' },
] as const

function buildHref(period: string, dimension: string, sort: string) {
  return `/admin/top-lists?period=${period}&dimension=${dimension}&sort=${sort}`
}

export default async function AdminTopListsPage({
  searchParams,
}: {
  searchParams: { period?: string; dimension?: string; sort?: string }
}) {
  const period = PERIODS.some((p) => p.value === searchParams.period)
    ? searchParams.period!
    : 'month'
  const dimension = DIMENSIONS.some((d) => d.value === searchParams.dimension)
    ? searchParams.dimension!
    : 'type'
  const sort = SORTS.some((s) => s.value === searchParams.sort) ? searchParams.sort! : 'desc'

  const res = await boardFetch(
    `/api/admin/top-lists?period=${period}&dimension=${dimension}&sort=${sort}`,
  )
  const data = res.ok
    ? ((await res.json()) as { buckets: TopListBucket[] })
    : { buckets: [] as TopListBucket[] }

  return (
    <>
      <h1 className="admin-section-title">Top lists</h1>
      <p className="admin-stat-sub">
        Listens are counted once per track per listener per day — a genuine play, not a raw click.
      </p>

      <div className="admin-filter-pills">
        {PERIODS.map((p) => (
          <a
            key={p.value}
            href={buildHref(p.value, dimension, sort)}
            className={period === p.value ? 'active' : undefined}
          >
            {p.label}
          </a>
        ))}
      </div>
      <div className="admin-filter-pills">
        {DIMENSIONS.map((d) => (
          <a
            key={d.value}
            href={buildHref(period, d.value, sort)}
            className={dimension === d.value ? 'active' : undefined}
          >
            {d.label}
          </a>
        ))}
      </div>
      <div className="admin-filter-pills">
        {SORTS.map((s) => (
          <a
            key={s.value}
            href={buildHref(period, dimension, s.value)}
            className={sort === s.value ? 'active' : undefined}
          >
            {s.label}
          </a>
        ))}
      </div>

      {data.buckets.length === 0 ? (
        <p className="admin-stat-sub">No listens recorded for this period yet.</p>
      ) : (
        <div className="top-lists-buckets">
          {data.buckets.map((bucket) => {
            const max = Math.max(...bucket.entries.map((e) => e.listens), 1)
            return (
              <div key={bucket.bucket} className="top-lists-bucket">
                <h2 className="top-lists-bucket__title">{bucket.bucket}</h2>
                {bucket.entries.map((entry, i) => (
                  <ProgressBar
                    key={entry.archiveItemId}
                    label={`#${i + 1} ${entry.title} — ${entry.artistName}`}
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
    </>
  )
}
