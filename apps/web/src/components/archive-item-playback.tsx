// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { VisualPreset } from '@tahti/shared'
import { ActiveTrackStage } from '@/components/active-track-stage'
import { TrackCommentsToggle } from '@/components/track-comments-toggle'
import { ReportButton } from '@/components/report-button'
import { LoveButton } from '@/components/love-button'
import { RepostButton } from '@/components/repost-button'
import { usePlayer, type PlayerTrack } from '@/contexts/player-context'
import { ArchiveDownloadButton } from './archive-download-button'
import { resolveChannelUrl } from '@/lib/app-url'

interface Props {
  channelSlug: string
  artistUsername: string
  /** Per-track credit override — shown in the player instead of @username when set. */
  artistCredit?: string | null
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
  /** Every playable track on the page, in display order — passed to load() so
   * 'ended' auto-advances to the next track instead of just stopping. */
  queue?: PlayerTrack[]
}

export function ArchiveItemPlayback({
  channelSlug,
  artistUsername,
  artistCredit,
  item,
  colorSchemeJson,
  isLoggedIn,
  queue,
}: Props) {
  const { track, playing, analyser, load, togglePlay, addToQueue, currentTime, duration, seek } =
    usePlayer()
  const isCurrent = track?.id === item.id
  const progress = isCurrent && duration > 0 ? currentTime / duration : 0

  const playerTrack = {
    id: item.id,
    kind: 'archive' as const,
    url: item.audioUrl,
    title: item.title,
    subtitle: artistCredit?.trim() || `@${artistUsername}`,
    href: `${resolveChannelUrl(channelSlug)}#archive-item-${item.id}`,
    artworkUrl: item.bannerUrl,
  }

  async function handleTogglePlay() {
    if (!isCurrent) {
      load(playerTrack, { autoplay: true, queue })
      return
    }
    await togglePlay()
  }

  return (
    <div
      className={`ch-archive-playback${isCurrent ? ' ch-archive-playback--current' : ''}${isCurrent && playing ? ' ch-archive-playback--playing' : ''}`}
    >
      {isCurrent && (
        <ActiveTrackStage
          playing={playing}
          preset={item.visualPreset}
          colorSchemeJson={colorSchemeJson}
          analyser={analyser}
          peaks={item.peaks}
          progress={progress}
          onSeek={seek}
          accentColor={item.accentColor}
          artworkUrl={item.bannerUrl}
          size="large"
          className="ch-archive-playback__stage"
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
          <LoveButton channelSlug={channelSlug} itemId={item.id} />
        </div>
        <button
          type="button"
          className="ch-archive-controls__queue"
          onClick={() => addToQueue(playerTrack)}
          title="Add to queue"
          aria-label="Add to queue"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
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
        <ArchiveDownloadButton
          channelSlug={channelSlug}
          artistUsername={artistUsername}
          itemId={item.id}
          repostToDownload={Boolean(item.repostToDownload)}
          followToDownload={Boolean(item.followToDownload)}
          downloadCount={item.downloadCount ?? 0}
        />
        <RepostButton channelSlug={channelSlug} itemId={item.id} />
        <TrackCommentsToggle
          archiveItemId={item.id}
          isLoggedIn={isLoggedIn}
          commentCount={item.commentCount ?? 0}
        />
        {isCurrent && <ReportButton targetType="ARCHIVE_ITEM" targetId={item.id} variant="icon" />}
      </div>
    </div>
  )
}
