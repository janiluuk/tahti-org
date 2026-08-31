// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState, type ReactNode } from 'react'

export type LibraryStatus = 'all' | 'unpublished' | 'drafts' | 'published'
export type LibrarySort = 'newest' | 'oldest' | 'title-asc' | 'title-desc'

const SORT_OPTIONS: { value: LibrarySort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title-asc', label: 'Title A–Z' },
  { value: 'title-desc', label: 'Title Z–A' },
]

interface LibraryBrowserProps<T> {
  items: T[]
  getTitle: (item: T) => string
  getCreatedAt?: (item: T) => string | null | undefined
  getPinnedAt?: (item: T) => string | null | undefined
  getStatus?: (item: T) => Exclude<LibraryStatus, 'all'>
  searchPlaceholder?: string
  emptyMessage?: string
  noMatchMessage?: string
  showStatusFilters?: boolean
  children: (visible: T[]) => ReactNode
}

function sortItems<T>(
  items: T[],
  sort: LibrarySort,
  getTitle: (item: T) => string,
  getCreatedAt: (item: T) => string | null | undefined,
  getPinnedAt: (item: T) => string | null | undefined,
) {
  const sorted = [...items].sort((a, b) => {
    switch (sort) {
      case 'title-asc':
        return getTitle(a).localeCompare(getTitle(b))
      case 'title-desc':
        return getTitle(b).localeCompare(getTitle(a))
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
  searchPlaceholder = 'Search library…',
  emptyMessage = 'Nothing in your library yet.',
  noMatchMessage = 'No library items match.',
  showStatusFilters = Boolean(getStatus),
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
    return sortItems(matched, sort, getTitle, getCreatedAt, getPinnedAt)
  }, [
    filter,
    getCreatedAt,
    getPinnedAt,
    getStatus,
    getTitle,
    items,
    search,
    showStatusFilters,
    sort,
  ])

  if (items.length === 0) {
    return <p className="studio-text-muted-sm">{emptyMessage}</p>
  }

  return (
    <div>
      <div className="archive-list__toolbar">
        {showStatusFilters && getStatus ? (
          <div className="archive-list__filters" role="group" aria-label="Filter library">
            {(['all', 'unpublished', 'drafts', 'published'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`archive-list__filter${filter === key ? ' archive-list__filter--active' : ''}`}
              >
                {key === 'all' ? 'All' : key.charAt(0).toUpperCase() + key.slice(1)} ({counts[key]})
              </button>
            ))}
          </div>
        ) : null}
        <div className="archive-list__toolbar-right">
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as LibrarySort)}
            className="studio-input archive-list__sort"
            aria-label="Sort library"
          >
            {SORT_OPTIONS.map((option) => (
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
            className="studio-input archive-list__search"
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
