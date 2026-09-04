// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState, type ReactNode } from 'react'

export type LibraryStatus = 'all' | 'unpublished' | 'drafts' | 'published'
export type LibrarySort =
  'newest' | 'oldest' | 'title-asc' | 'title-desc' | 'duration-desc' | 'bpm-asc' | 'genre-asc'

const BASE_SORT_OPTIONS: { value: LibrarySort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title-asc', label: 'Title A–Z' },
  { value: 'title-desc', label: 'Title Z–A' },
]

/** Extra sort options only shown when the matching getter prop is supplied —
 * not every LibraryBrowser consumer's items have duration/bpm/genre. */
const OPTIONAL_SORT_OPTIONS: {
  value: LibrarySort
  label: string
  getter: 'getDurationSec' | 'getBpm' | 'getGenre'
}[] = [
  { value: 'duration-desc', label: 'Longest first', getter: 'getDurationSec' },
  { value: 'bpm-asc', label: 'BPM', getter: 'getBpm' },
  { value: 'genre-asc', label: 'Genre A–Z', getter: 'getGenre' },
]

interface LibraryBrowserProps<T> {
  items: T[]
  getTitle: (item: T) => string
  getCreatedAt?: (item: T) => string | null | undefined
  getPinnedAt?: (item: T) => string | null | undefined
  getStatus?: (item: T) => Exclude<LibraryStatus, 'all'>
  getDurationSec?: (item: T) => number | null | undefined
  getBpm?: (item: T) => number | null | undefined
  getGenre?: (item: T) => string | null | undefined
  searchPlaceholder?: string
  emptyMessage?: string
  noMatchMessage?: string
  showStatusFilters?: boolean
  /** Extra control rendered in the toolbar's right-hand cluster, before sort/search. */
  toolbarExtra?: ReactNode
  children: (visible: T[]) => ReactNode
}

function sortItems<T>(
  items: T[],
  sort: LibrarySort,
  getTitle: (item: T) => string,
  getCreatedAt: (item: T) => string | null | undefined,
  getPinnedAt: (item: T) => string | null | undefined,
  getDurationSec: (item: T) => number | null | undefined,
  getBpm: (item: T) => number | null | undefined,
  getGenre: (item: T) => string | null | undefined,
) {
  const sorted = [...items].sort((a, b) => {
    switch (sort) {
      case 'title-asc':
        return getTitle(a).localeCompare(getTitle(b))
      case 'title-desc':
        return getTitle(b).localeCompare(getTitle(a))
      case 'duration-desc':
        return (getDurationSec(b) ?? 0) - (getDurationSec(a) ?? 0)
      case 'bpm-asc':
        return (getBpm(a) ?? Infinity) - (getBpm(b) ?? Infinity)
      case 'genre-asc':
        return (getGenre(a) ?? '').localeCompare(getGenre(b) ?? '')
      case 'oldest':
        return new Date(getCreatedAt(a) ?? 0).getTime() - new Date(getCreatedAt(b) ?? 0).getTime()
      case 'newest':
      default:
        return new Date(getCreatedAt(b) ?? 0).getTime() - new Date(getCreatedAt(a) ?? 0).getTime()
    }
  })

  return sorted.sort((a, b) => {
    const aPinned = getPinnedAt(a) ? new Date(getPinnedAt(a)!).getTime() : 0
    const bPinned = getPinnedAt(b) ? new Date(getPinnedAt(b)!).getTime() : 0
    if (aPinned === 0 && bPinned === 0) return 0
    return bPinned - aPinned
  })
}

/**
 * The single library browsing surface used by Studio pickers and the main
 * Discography view. Consumers own the row actions; this component owns the
 * interaction model: search, status filters, sorting, pinned-first ordering,
 * and consistent empty states.
 */
export function LibraryBrowser<T>({
  items,
  getTitle,
  getCreatedAt = () => null,
  getPinnedAt = () => null,
  getStatus,
  getDurationSec,
  getBpm,
  getGenre,
  searchPlaceholder = 'Search library…',
  emptyMessage = 'Nothing in your library yet.',
  noMatchMessage = 'No library items match.',
  showStatusFilters = Boolean(getStatus),
  toolbarExtra,
  children,
}: LibraryBrowserProps<T>) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<LibraryStatus>('all')
  const [sort, setSort] = useState<LibrarySort>('newest')

  const counts = useMemo(() => {
    const result: Record<LibraryStatus, number> = {
      all: items.length,
      unpublished: 0,
      drafts: 0,
      published: 0,
    }
    if (getStatus) for (const item of items) result[getStatus(item)]++
    return result
  }, [getStatus, items])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matched = items.filter((item) => {
      if (showStatusFilters && filter !== 'all' && getStatus?.(item) !== filter) return false
      return !query || getTitle(item).toLowerCase().includes(query)
    })
    return sortItems(
      matched,
      sort,
      getTitle,
      getCreatedAt,
      getPinnedAt,
      getDurationSec ?? (() => null),
      getBpm ?? (() => null),
      getGenre ?? (() => null),
    )
  }, [
    filter,
    getBpm,
    getCreatedAt,
    getDurationSec,
    getGenre,
    getPinnedAt,
    getStatus,
    getTitle,
    items,
    search,
    showStatusFilters,
    sort,
  ])

  const sortOptions = [
    ...BASE_SORT_OPTIONS,
    ...OPTIONAL_SORT_OPTIONS.filter((o) =>
      o.getter === 'getDurationSec' ? getDurationSec : o.getter === 'getBpm' ? getBpm : getGenre,
    ),
  ]

  if (items.length === 0) {
    return <p className="studio-text-muted-sm">{emptyMessage}</p>
  }

  return (
    <div>
      <div className="sound-list__toolbar">
        {showStatusFilters && getStatus ? (
          <div className="sound-list__filters" role="group" aria-label="Filter library">
            {(['all', 'unpublished', 'drafts', 'published'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`sound-list__filter${filter === key ? ' sound-list__filter--active' : ''}`}
              >
                {key === 'all' ? 'All' : key.charAt(0).toUpperCase() + key.slice(1)} ({counts[key]})
              </button>
            ))}
          </div>
        ) : null}
        <div className="sound-list__toolbar-right">
          {toolbarExtra}
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as LibrarySort)}
            className="studio-input sound-list__sort"
            aria-label="Sort library"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder.replace('…', '')}
            className="studio-input sound-list__search"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="studio-text-muted-sm studio-mt-md">{noMatchMessage}</p>
      ) : (
        children(visible)
      )}
    </div>
  )
}
