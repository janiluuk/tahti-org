// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { usePlayer, type PlayerTrack } from '@/contexts/player-context'

type Props = {
  id: string
  title: string
  audioUrl: string
  artistUsername: string
  thumbUrl: string | null
  durationLabel: string | null
  /** Sibling playable tracks in display order — enables auto-advance + loop on 'ended'. */
  queue?: PlayerTrack[]
}

/** Public collection page — play button for a regular Tahti-hosted track, driving the shared mini-player. */
export function ArchiveTrackRow({
  id,
  title,
  audioUrl,
  artistUsername,
  thumbUrl,
  durationLabel,
  queue,
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
      </div>
    </li>
  )
}
