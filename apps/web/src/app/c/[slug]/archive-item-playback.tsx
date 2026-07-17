// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { VisualPreset } from '@tahti/shared'
import { ArchiveWaveform } from '@/components/archive-waveform'
import { ChannelVisualizer } from '@/components/visuals/channel-visualizer'
import { usePlayer } from '@/contexts/player-context'
import { ArchiveDownloadButton } from './archive-download'

interface Props {
  channelSlug: string
  artistUsername: string
  item: {
    id: string
    title: string
    audioUrl: string
    bannerUrl?: string | null
    peaks?: number[] | null
    visualPreset?: VisualPreset | string | null
    repostToDownload?: boolean
    followToDownload?: boolean
  }
  colorSchemeJson?: string | null
}

export function ArchiveItemPlayback({ channelSlug, artistUsername, item, colorSchemeJson }: Props) {
  const { track, playing, analyser, load, togglePlay, addToQueue } = usePlayer()
  const isCurrent = track?.id === item.id
  const preset = (item.visualPreset ?? 'MINIMAL') as VisualPreset
  const showViz = isCurrent && playing && preset !== 'MINIMAL'

  const playerTrack = {
    id: item.id,
    kind: 'archive' as const,
    url: item.audioUrl,
    title: item.title,
    subtitle: `@${artistUsername}`,
    href: `/c/${channelSlug}#archive-item-${item.id}`,
    artworkUrl: item.bannerUrl,
  }

  async function handleTogglePlay() {
    if (!isCurrent) {
      load(playerTrack, { autoplay: true })
      return
    }
    await togglePlay()
  }

  return (
    <div className="ch-archive-playback">
      {showViz && (
        <ChannelVisualizer
          preset={preset}
          colorSchemeJson={colorSchemeJson}
          analyser={analyser}
          className="ch-archive-item-viz"
        />
      )}
      <ArchiveWaveform peaks={item.peaks} />
      <div className="ch-archive-controls">
        <button
          type="button"
          className="ch-archive-controls__play"
          onClick={() => void handleTogglePlay()}
          aria-label={isCurrent && playing ? 'Pause' : 'Play'}
          data-testid="channel-archive-play-toggle"
        >
          {isCurrent && playing ? '❚❚' : '▶'}
        </button>
        <span className="ch-archive-controls__title">{item.title}</span>
        <button
          type="button"
          className="ch-archive-controls__queue"
          onClick={() => addToQueue(playerTrack)}
          aria-label={`Add ${item.title} to queue`}
          title="Add to queue"
        >
          +
        </button>
      </div>
      <ArchiveDownloadButton
        channelSlug={channelSlug}
        artistUsername={artistUsername}
        itemId={item.id}
        repostToDownload={Boolean(item.repostToDownload)}
        followToDownload={Boolean(item.followToDownload)}
      />
    </div>
  )
}
