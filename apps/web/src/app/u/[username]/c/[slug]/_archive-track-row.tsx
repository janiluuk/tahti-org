// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { usePlayer, type PlayerTrack } from '@/contexts/player-context'
import { ReportButton } from '@/components/report-button'
import { LoveButton } from '@/components/love-button'
import { ActiveTrackStage } from '@/components/active-track-stage'
import type { VisualPreset } from '@tahti/shared'
import { CollectionCoverButton } from './_collection-gallery'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type Props = {
  id: string
  title: string
  audioUrl: string
  artistUsername: string
  /** Owning channel's slug — needed for the love-button API, which is scoped to
   * a channel. Null only for the (rare) archive item with no channel at all. */
  channelSlug: string | null
  thumbUrl: string | null
  durationLabel: string | null
  peaks?: number[] | null
  visualPreset?: VisualPreset | string | null
  colorSchemeJson?: string | null
  /** Sibling playable tracks in display order — enables auto-advance + loop on 'ended'. */
  queue?: PlayerTrack[]
  /** Set when a contributor other than the playlist owner added this track
   * (collaborative playlists) — shown as a small "added by" + optional note. */
  addedByDisplayName?: string | null
  addNote?: string | null
}

/** Public collection page — play button for a regular Tahti-hosted track, driving the shared mini-player. */
export function ArchiveTrackRow({
  id,
  title,
  audioUrl,
  artistUsername,
  channelSlug,
  thumbUrl,
  durationLabel,
  peaks: peaksProp,
  visualPreset,
  colorSchemeJson,
  queue,
  addedByDisplayName,
  addNote,
}: Props) {
  const { track, playing, analyser, load, togglePlay, currentTime, duration, seek } = usePlayer()
  const isCurrent = track?.id === id
  const progress = isCurrent && duration > 0 ? currentTime / duration : 0
  const [fetchedPeaks, setFetchedPeaks] = useState<number[] | null>(null)

  useEffect(() => {
    if (!isCurrent || peaksProp?.length) {
      setFetchedPeaks(null)
      return
    }
    let cancelled = false
    void fetch(`${API_URL}/api/reactions/track/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { peaks?: number[] | null } | null) => {
        if (!cancelled && data?.peaks?.length) setFetchedPeaks(data.peaks)
      })
      .catch(() => {
        /* peaks are visual-only */
      })
    return () => {
      cancelled = true
    }
  }, [id, isCurrent, peaksProp])

  const peaks = peaksProp?.length ? peaksProp : fetchedPeaks

  async function handleTogglePlay() {
    if (!isCurrent) {
      load(
        { id, kind: 'archive', url: audioUrl, title, subtitle: `@${artistUsername}` },
        { autoplay: true, queue },
      )
      return
    }
    await togglePlay()
  }

  return (
    <li
      className={`prof-collection-item-row${isCurrent ? ' prof-collection-item-row--current' : ''}${isCurrent && playing ? ' prof-collection-item-row--playing' : ''}`}
    >
      <div className="prof-collection-item-row__main">
        <button
          type="button"
          className="prof-collection-play"
          onClick={() => void handleTogglePlay()}
          aria-label={isCurrent && playing ? `Pause ${title}` : `Play ${title}`}
        >
          {isCurrent && playing ? '❚❚' : '▶'}
        </button>
        <CollectionCoverButton
          url={thumbUrl}
          className="prof-collection-cover prof-collection-cover--item"
          imgWidth={40}
          imgHeight={40}
        />
        <div className="prof-collection-item-body">
          <div className="prof-collection-title">{title}</div>
          {durationLabel && <span className="prof-list-meta">{durationLabel}</span>}
          {addedByDisplayName && (
            <span className="prof-list-meta prof-collection-item-added-by">
              added by {addedByDisplayName}
              {addNote && (
                <span className="prof-collection-item-note"> — &ldquo;{addNote}&rdquo;</span>
              )}
            </span>
          )}
        </div>
        {channelSlug && <LoveButton channelSlug={channelSlug} itemId={id} />}
        {isCurrent && <ReportButton targetType="ARCHIVE_ITEM" targetId={id} variant="icon" />}
      </div>
      {isCurrent && (
        <ActiveTrackStage
          playing={playing}
          preset={visualPreset}
          colorSchemeJson={colorSchemeJson}
          analyser={analyser}
          peaks={peaks}
          progress={progress}
          onSeek={seek}
          artworkUrl={thumbUrl}
          size="large"
          className="prof-collection-item-row__stage"
        />
      )}
    </li>
  )
}
