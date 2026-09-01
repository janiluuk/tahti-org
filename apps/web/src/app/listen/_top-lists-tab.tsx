// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { resolveChannelUrl } from '@/lib/app-url'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

type Period = 'week' | 'month'
type Kind = 'shows' | 'dj_sets' | 'albums' | 'singles'

interface TopListEntry {
  archiveItemId: string
  listens: number
  title: string
  artistName: string
  channelSlug: string
  bannerUrl: string | null
}

interface LatestRelease {
  id: string
  title: string
  type: string
  releaseDate: string
  artworkUrl: string | null
  smartLinkSlug: string
  artistDisplayName: string
}

const KIND_TABS: { value: Kind; label: string }[] = [
  { value: 'shows', label: 'Shows' },
  { value: 'dj_sets', label: 'DJ sets' },
  { value: 'albums', label: 'Albums' },
  { value: 'singles', label: 'Singles' },
]

const KIND_CONTENT_TYPES: Record<'shows' | 'dj_sets', string> = {
  shows: 'RADIO_SHOW,LIVE,PODCAST',
  dj_sets: 'DJ_SET',
}
const KIND_RELEASE_TYPES: Record<'albums' | 'singles', string> = {
  albums: 'ALBUM',
  singles: 'SINGLE',
}

function isReleaseKind(kind: Kind): kind is 'albums' | 'singles' {
  return kind === 'albums' || kind === 'singles'
}

export function TopListsTab() {
  const [period, setPeriod] = useState<Period>('week')
  const [kind, setKind] = useState<Kind>('shows')
  const [entries, setEntries] = useState<TopListEntry[]>([])
  const [releases, setReleases] = useState<LatestRelease[]>([])
  const [latestRelease, setLatestRelease] = useState<LatestRelease | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      try {
        if (isReleaseKind(kind)) {
          const res = await fetch(
            `${API_BASE}/api/releases/latest?type=${KIND_RELEASE_TYPES[kind]}&limit=20`,
          )
          if (!cancelled && res.ok) {
            const data = (await res.json()) as { releases: LatestRelease[] }
            setReleases(data.releases)
          }
        } else {
          const res = await fetch(
            `${API_BASE}/api/top-lists?period=${period}&contentTypes=${KIND_CONTENT_TYPES[kind]}`,
          )
          if (!cancelled && res.ok) {
            const data = (await res.json()) as { entries: TopListEntry[] }
            setEntries(data.entries)
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [period, kind])

  // "Latest release" callout shown alongside the week view specifically.
  useEffect(() => {
    if (period !== 'week') return
    let cancelled = false
    fetch(`${API_BASE}/api/releases/latest?limit=1`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { releases: LatestRelease[] } | null) => {
        if (!cancelled && data?.releases[0]) setLatestRelease(data.releases[0])
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [period])

  const showingReleases = isReleaseKind(kind)

  return (
    <div className="top-lists-tab">
      {period === 'week' && latestRelease && (
        <Link href={`/r/${latestRelease.smartLinkSlug}`} className="top-lists-latest-release">
          <span className="top-lists-latest-release__label">Latest release</span>
          {latestRelease.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={latestRelease.artworkUrl}
              alt=""
              loading="lazy"
              className="top-lists-latest-release__art"
            />
          ) : (
            <span className="top-lists-latest-release__art top-lists-latest-release__art--fallback" />
          )}
          <span className="top-lists-latest-release__meta">
            <span className="top-lists-latest-release__title">{latestRelease.title}</span>
            <span className="top-lists-latest-release__artist">
              {latestRelease.artistDisplayName}
            </span>
          </span>
        </Link>
      )}

      {!showingReleases && (
        <div className="top-lists-period-toggle" role="tablist" aria-label="Period">
          {(['week', 'month'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              className={`top-lists-period-btn${period === p ? ' top-lists-period-btn--active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === 'week' ? 'This week' : 'This month'}
            </button>
          ))}
        </div>
      )}

      <div className="top-lists-kind-tabs" role="tablist" aria-label="Category">
        {KIND_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={kind === t.value}
            className={`top-lists-kind-tab${kind === t.value ? ' top-lists-kind-tab--active' : ''}`}
            onClick={() => setKind(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="public-empty-card__hint">Loading…</p>
      ) : showingReleases ? (
        releases.length === 0 ? (
          <div className="public-empty-card">
            <p className="public-empty-card__text">No releases yet.</p>
          </div>
        ) : (
          <ol className="top-lists-ranked-list">
            {releases.map((r, i) => (
              <li key={r.id} className="top-lists-ranked-item">
                <span className="top-lists-ranked-item__rank">{i + 1}</span>
                {r.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.artworkUrl}
                    alt=""
                    loading="lazy"
                    className="top-lists-ranked-item__art"
                  />
                ) : (
                  <span className="top-lists-ranked-item__art top-lists-ranked-item__art--fallback" />
                )}
                <Link href={`/r/${r.smartLinkSlug}`} className="top-lists-ranked-item__meta">
                  <span className="top-lists-ranked-item__title">{r.title}</span>
                  <span className="top-lists-ranked-item__artist">{r.artistDisplayName}</span>
                </Link>
                <span className="top-lists-ranked-item__count">
                  {new Date(r.releaseDate).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </li>
            ))}
          </ol>
        )
      ) : entries.length === 0 ? (
        <div className="public-empty-card">
          <p className="public-empty-card__text">No listens recorded for this period yet.</p>
        </div>
      ) : (
        <ol className="top-lists-ranked-list">
          {entries.map((e, i) => (
            <li key={e.archiveItemId} className="top-lists-ranked-item">
              <span className="top-lists-ranked-item__rank">{i + 1}</span>
              {e.bannerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.bannerUrl}
                  alt=""
                  loading="lazy"
                  className="top-lists-ranked-item__art"
                />
              ) : (
                <span className="top-lists-ranked-item__art top-lists-ranked-item__art--fallback" />
              )}
              <Link
                href={`${resolveChannelUrl(e.channelSlug)}#archive-item-${e.archiveItemId}`}
                className="top-lists-ranked-item__meta"
              >
                <span className="top-lists-ranked-item__title">{e.title}</span>
                <span className="top-lists-ranked-item__artist">{e.artistName}</span>
              </Link>
              <span className="top-lists-ranked-item__count">
                {e.listens} {e.listens === 1 ? 'listen' : 'listens'}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
