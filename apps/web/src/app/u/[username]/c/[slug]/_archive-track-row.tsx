// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { usePlayer, type PlayerTrack } from '@/contexts/player-context'
import { ReportButton } from '@/components/report-button'
import { LoveButton } from '@/components/love-button'

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
  queue,
  addedByDisplayName,
  addNote,
}: Props) {
  const { track, playing, load, togglePlay } = usePlayer()
  const isCurrent = track?.id === id

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
    <li className="prof-collection-item-row">
      <button
        type="button"
        className="prof-collection-play"
        onClick={() => void handleTogglePlay()}
        aria-label={isCurrent && playing ? `Pause ${title}` : `Play ${title}`}
      >
        {isCurrent && playing ? '❚❚' : '▶'}
      </button>
      <div className="prof-collection-cover prof-collection-cover--item">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="" width={40} height={40} />
        ) : (
          <span className="prof-collection-cover-ph" aria-hidden />
        )}
      </div>
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
    </li>
  )
}
