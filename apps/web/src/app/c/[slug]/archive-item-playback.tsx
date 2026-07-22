// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { VisualPreset } from '@tahti/shared'
import { ArchiveWaveform } from '@/components/archive-waveform'
import { ChannelVisualizer } from '@/components/visuals/channel-visualizer'
import { TrackCommentsToggle } from '@/components/track-comments-toggle'
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
    commentCount?: number
    downloadCount?: number
    accentColor?: string | null
  }
  colorSchemeJson?: string | null
  isLoggedIn: boolean
}

export function ArchiveItemPlayback({
  channelSlug,
  artistUsername,
  item,
  colorSchemeJson,
  isLoggedIn,
}: Props) {
  const { track, playing, analyser, load, togglePlay, addToQueue, currentTime, duration, seek } =
    usePlayer()
  const isCurrent = track?.id === item.id
  const progress = isCurrent && duration > 0 ? currentTime / duration : 0
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
    <div className={`ch-archive-playback${isCurrent ? ' ch-archive-playback--current' : ''}`}>
      {showViz && (
        <ChannelVisualizer
          preset={preset}
          colorSchemeJson={colorSchemeJson}
          analyser={analyser}
          className="ch-archive-item-viz"
        />
      )}
      {/* Waveform only for the currently-loaded track — keeps every other row a
       * single compact line instead of a tall card, closer to how a music-app
       * playlist lists tracks (detail only on the one that's actually playing). */}
      {isCurrent && (
        <ArchiveWaveform
          peaks={item.peaks}
          progress={progress}
          onSeek={seek}
          accentColor={item.accentColor}
        />
      )}
      <div className="ch-archive-controls-row">
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
          downloadCount={item.downloadCount ?? 0}
        />
        <TrackCommentsToggle
          archiveItemId={item.id}
          isLoggedIn={isLoggedIn}
          commentCount={item.commentCount ?? 0}
        />
      </div>
    </div>
  )
}
