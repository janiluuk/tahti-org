'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { usePlayer, type PlayerTrack } from '@/contexts/player-context'
import { useToast } from '@/contexts/toast-context'
import { useMomentaryPulse } from '@/lib/use-momentary-pulse'

export type CatalogPlaybackTrack = {
  id: string
  title: string
  audioUrl: string
  subtitle?: string
  artworkUrl?: string | null
  href?: string
}

export function CatalogPlaybackButtons({
  item,
  queue,
}: {
  item: CatalogPlaybackTrack
  queue?: CatalogPlaybackTrack[]
}) {
  const { track, playing, load, togglePlay, addToQueue } = usePlayer()
  const { showToast } = useToast()
  const [queuePulsing, pulseQueue] = useMomentaryPulse()
  const playerTrack = toPlayerTrack(item)
  const isCurrent = track?.id === playerTrack.id

  async function toggle() {
    if (isCurrent) {
      await togglePlay()
      return
    }
    load(playerTrack, {
      autoplay: true,
      queue: queue?.map(toPlayerTrack),
    })
  }

  function enqueue() {
    pulseQueue()
    const added = addToQueue(playerTrack)
    showToast(
      added ? `Added “${item.title}” to the queue.` : `“${item.title}” is already in the queue.`,
      added ? 'success' : 'info',
    )
  }

  return (
    <span className="catalog-playback-buttons">
      <button
        type="button"
        onClick={() => void toggle()}
        title={isCurrent && playing ? 'Pause' : 'Play'}
        aria-label={isCurrent && playing ? `Pause ${item.title}` : `Play ${item.title}`}
      >
        {isCurrent && playing ? '❚❚' : '▶'}
      </button>
      <button
        type="button"
        onClick={enqueue}
        disabled={queuePulsing}
        title="Add to queue"
        aria-label={`Add ${item.title} to queue`}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2.5 4h11M2.5 8h11M2.5 12h7"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M12 10.5v4M10 12.5h4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </span>
  )
}

function toPlayerTrack(item: CatalogPlaybackTrack): PlayerTrack {
  return {
    id: item.id,
    kind: 'archive',
    url: item.audioUrl,
    title: item.title,
    subtitle: item.subtitle,
    artworkUrl: item.artworkUrl,
    href: item.href,
  }
}
