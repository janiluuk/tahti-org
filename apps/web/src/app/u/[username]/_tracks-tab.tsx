// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { hearthisEmbedSrc, mixcloudEmbedSrc, trackIdFromSpotifyUri } from '@tahti/shared'
import { LoveButton } from '@/components/love-button'
import { ReportButton } from '@/components/report-button'
import { usePlayer, type PlayerTrack } from '@/contexts/player-context'
import { LibraryBrowser } from '@/components/library/library-browser'

export interface TrackTabItem {
  id: string
  title: string
  artistName?: string | null
  durationSec: number | null
  bannerUrl: string | null
  playUrl: string | null
  pinned: boolean
  pinnedAt: string | null
  trackOrder: number
  createdAt: string
  channelItemUrl: string | null
  releaseSlug: string | null
  /** *_EMBED-sourced items (no audio file — playUrl is always null for these)
   * need embedProvider + embedUri to render the matching embed player. */
  source?: string
  embedProvider?: string | null
  embedUri?: string | null
}

type SourceFilter = 'all' | 'local' | 'HEARTHIS' | 'SPOTIFY' | 'MIXCLOUD'

const SOURCE_FILTER_LABELS: Record<SourceFilter, string> = {
  all: 'All',
  local: 'Local',
  HEARTHIS: 'hearthis.at',
  SPOTIFY: 'Spotify',
  MIXCLOUD: 'Mixcloud',
}

function sourceLabel(embedProvider?: string | null): string | null {
  switch (embedProvider) {
    case 'HEARTHIS':
      return 'hearthis.at'
    case 'SPOTIFY':
      return 'Spotify'
    case 'MIXCLOUD':
      return 'Mixcloud'
    default:
      return null
  }
}

export function formatDuration(sec: number | null): string {
  if (sec == null) return ''
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Small "streams from elsewhere" indicator — deliberately provider-neutral
 * (an external-link glyph, not a brand logo) since we don't carry per-provider
 * logo assets; the tooltip/aria-label names the actual source. */
function EmbedSourceIcon({ label }: { label: string }) {
  return (
    <span className="prof-collection-embed-icon" title={`Streams from ${label}`}>
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden focusable="false">
        <path
          d="M4.5 7.5 10 2M10 2H6M10 2v4"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8.5 6.5V9.5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1H5.5"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">Streams from {label}</span>
    </span>
  )
}

/** The expanded row's inline widget for an embed-sourced track. Mirrors the
 * Mixed-source-collections embed rows (MixcloudEmbedRow/SpotifyEmbedRow/
 * HearthisEmbedRow): the iframe only mounts once the row is expanded, so the
 * provider never sees a listener's IP just from browsing the discography. */
function EmbedFrame({ track }: { track: TrackTabItem }) {
  if (!track.embedUri) return null
  switch (track.embedProvider) {
    case 'HEARTHIS':
      return (
        <iframe
          title={`${track.title} — hearthis.at player`}
          src={hearthisEmbedSrc(track.embedUri, { autoplay: true })}
          className="prof-collection-expand__frame prof-collection-expand__frame--hearthis"
          allow="autoplay"
          loading="lazy"
        />
      )
    case 'MIXCLOUD':
      return (
        <iframe
          title={track.title}
          src={mixcloudEmbedSrc(track.embedUri)}
          className="prof-collection-expand__frame"
          allow="autoplay"
          loading="lazy"
        />
      )
    case 'SPOTIFY': {
      const trackId = trackIdFromSpotifyUri(track.embedUri)
      if (!trackId) return null
      return (
        <iframe
          title={track.title}
          src={`https://open.spotify.com/embed/track/${trackId}`}
          className="prof-collection-expand__frame prof-collection-expand__frame--spotify"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      )
    }
    default:
      return null
  }
}

export function TracksTab({
  tracks,
  isOwner,
  channelSlug,
}: {
  tracks: TrackTabItem[]
  isOwner: boolean
  /** Needed for the love-button API (scoped to a channel) — null only for the
   * (rare) archive item with no channel at all. */
  channelSlug: string | null
}) {
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const { track: playerTrack, load } = usePlayer()

  const sourceCounts = useMemo(() => {
    const counts: Record<SourceFilter, number> = {
      all: tracks.length,
      local: 0,
      HEARTHIS: 0,
      SPOTIFY: 0,
      MIXCLOUD: 0,
    }
    for (const t of tracks) {
      if (
        t.embedProvider === 'HEARTHIS' ||
        t.embedProvider === 'SPOTIFY' ||
        t.embedProvider === 'MIXCLOUD'
      ) {
        counts[t.embedProvider]++
      } else {
        counts.local++
      }
    }
    return counts
  }, [tracks])

  const availableSourceFilters = (
    ['all', 'local', 'HEARTHIS', 'SPOTIFY', 'MIXCLOUD'] as const
  ).filter((key) => key === 'all' || sourceCounts[key] > 0)
  const hasEmbeds = tracks.some((t) => t.embedProvider)

  const sourceFiltered = useMemo(() => {
    if (sourceFilter === 'all') return tracks
    if (sourceFilter === 'local') return tracks.filter((t) => !t.embedProvider)
    return tracks.filter((t) => t.embedProvider === sourceFilter)
  }, [tracks, sourceFilter])

  function toggleRow(item: TrackTabItem, queue: PlayerTrack[]) {
    const nowExpanded = expandedTrackId === item.id
    if (item.embedProvider && item.embedUri) {
      setExpandedTrackId(nowExpanded ? null : item.id)
      return
    }
    if (!item.playUrl) return
    if (nowExpanded) {
      setExpandedTrackId(null)
      return
    }
    setExpandedTrackId(item.id)
    if (playerTrack?.id !== item.id) {
      load(
        {
          id: item.id,
          kind: 'archive',
          url: item.playUrl,
          title: item.title,
          subtitle: item.artistName ?? undefined,
          artworkUrl: item.bannerUrl,
        },
        { autoplay: true, queue },
      )
    }
  }

  if (tracks.length === 0) {
    return (
      <div className="public-empty-card">
        <p className="public-empty-card__text">No tracks yet.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="prof-sec-label-row">
        <div className="prof-sec-label">Tracks</div>
        <div className="prof-sec-label-row__actions">
          <div className="prof-sec-count">{tracks.length} total</div>
          {isOwner && (
            <Link href="/dashboard/archive" className="prof-tracks-studio-link">
              Manage in Studio
            </Link>
          )}
        </div>
      </div>
      <div data-tahti-ui="studio">
        {hasEmbeds && (
          <div
            className="archive-list__filters prof-collection-source-filters"
            role="group"
            aria-label="Filter by source"
          >
            {availableSourceFilters.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSourceFilter(key)}
                className={`archive-list__filter${sourceFilter === key ? ' archive-list__filter--active' : ''}`}
              >
                {SOURCE_FILTER_LABELS[key]} ({sourceCounts[key]})
              </button>
            ))}
          </div>
        )}
        <LibraryBrowser
          items={sourceFiltered}
          getTitle={(item) => item.title}
          getCreatedAt={(item) => item.createdAt}
          getPinnedAt={(item) => item.pinnedAt}
          searchPlaceholder="Search archive…"
          emptyMessage="No tracks yet."
          noMatchMessage="No tracks match."
          showStatusFilters={false}
        >
          {(visible) => {
            const queue: PlayerTrack[] = visible
              .filter((item) => item.playUrl)
              .map((item) => ({
                id: item.id,
                kind: 'archive' as const,
                url: item.playUrl ?? '',
                title: item.title,
                subtitle: item.artistName ?? undefined,
                artworkUrl: item.bannerUrl,
              }))
            return (
              <ul className="prof-list prof-collection-list">
                {visible.map((t) => {
                  const isExpanded = expandedTrackId === t.id
                  const label = sourceLabel(t.embedProvider)
                  return (
                    <li key={t.id}>
                      <div className="prof-collection-row">
                        <button
                          type="button"
                          className="prof-collection-play"
                          onClick={() => toggleRow(t, queue)}
                          aria-label={isExpanded ? `Close ${t.title}` : `Play ${t.title}`}
                        >
                          {isExpanded ? '×' : '▶'}
                        </button>
                        <button
                          type="button"
                          className="prof-collection-row__clickarea"
                          onClick={() => toggleRow(t, queue)}
                          aria-label={isExpanded ? `Close ${t.title}` : `Play ${t.title}`}
                        >
                          <div className="prof-collection-cover">
                            {t.bannerUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={t.bannerUrl} alt="" width={76} height={76} />
                            ) : (
                              <span className="prof-collection-cover-ph" aria-hidden />
                            )}
                          </div>
                          <div>
                            <div className="prof-collection-title">{t.title}</div>
                            <div className="prof-list-meta prof-list-meta--strong">
                              {t.artistName ? `${t.artistName} · ` : null}
                              {formatDuration(t.durationSec)}
                              {t.pinned && ' · Pinned'}
                              {label && <EmbedSourceIcon label={label} />}
                            </div>
                          </div>
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="prof-collection-expand">
                          <EmbedFrame track={t} />
                          <div className="prof-track-modal__actions prof-collection-expand__actions">
                            {channelSlug && (
                              <div className="prof-track-modal__love">
                                <LoveButton channelSlug={channelSlug} itemId={t.id} />
                              </div>
                            )}
                            <ReportButton
                              targetType="ARCHIVE_ITEM"
                              targetId={t.id}
                              variant="icon"
                            />
                            {t.releaseSlug ? (
                              <Link
                                href={`/r/${t.releaseSlug}`}
                                className="prof-track-modal__primary"
                              >
                                View release
                              </Link>
                            ) : (
                              t.channelItemUrl && (
                                <Link href={t.channelItemUrl} className="prof-track-modal__primary">
                                  View on channel
                                </Link>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )
          }}
        </LibraryBrowser>
      </div>
    </div>
  )
}
