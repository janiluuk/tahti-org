// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { VisualPreset } from '@tahti/shared'
import { SoundWaveform } from '@/components/sound-waveform'
import { ChannelVisualizer } from '@/components/visuals/channel-visualizer'

/** Prefer the track's preset; when unset/MINIMAL, fall back to the bright
 * water-ripple effect (the track's own cover art, rippling in time with the
 * music) so every track reads as "now playing" with a good-looking default,
 * unless the artist has explicitly picked something else. */
export function resolveActiveTrackPreset(preset?: VisualPreset | string | null): VisualPreset {
  if (preset && preset !== 'MINIMAL') return preset as VisualPreset
  return 'WATER_RIPPLE'
}

/**
 * Expanded “now playing” stage for list rows and the desktop mini-player dock:
 * Three.js visualizer behind a seekable waveform so the active track is obvious.
 */
export function ActiveTrackStage({
  playing,
  preset,
  colorSchemeJson,
  analyser,
  peaks,
  progress,
  onSeek,
  accentColor,
  artworkUrl,
  size = 'default',
  className,
}: {
  playing: boolean
  preset?: VisualPreset | string | null
  colorSchemeJson?: string | null
  analyser?: AnalyserNode | null
  peaks?: number[] | null
  progress: number
  onSeek?: (ratio: number) => void
  accentColor?: string | null
  /** Cover art to ripple — only used by the WATER_RIPPLE preset. */
  artworkUrl?: string | null
  size?: 'default' | 'large'
  className?: string
}) {
  const resolved = resolveActiveTrackPreset(preset)
  const showWave = Boolean(peaks && peaks.length > 0)

  return (
    <div
      className={`active-track-stage${playing ? ' active-track-stage--playing' : ''}${size === 'large' ? ' active-track-stage--large' : ''}${className ? ` ${className}` : ''}`}
    >
      <ChannelVisualizer
        preset={resolved}
        colorSchemeJson={colorSchemeJson}
        analyser={playing ? analyser : null}
        artworkUrl={artworkUrl}
        className="active-track-stage__viz"
      />
      <div className="active-track-stage__foreground">
        {showWave ? (
          <SoundWaveform
            peaks={peaks}
            progress={progress}
            onSeek={onSeek}
            accentColor={accentColor}
            size={size === 'large' ? 'large' : 'default'}
          />
        ) : (
          <div
            className="active-track-stage__progress"
            role={onSeek ? 'slider' : undefined}
            aria-label={onSeek ? 'Seek' : undefined}
            aria-valuenow={onSeek ? Math.round(progress * 100) : undefined}
            aria-valuemin={onSeek ? 0 : undefined}
            aria-valuemax={onSeek ? 100 : undefined}
            onClick={
              onSeek
                ? (e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    onSeek((e.clientX - rect.left) / rect.width)
                  }
                : undefined
            }
          >
            <span
              className="active-track-stage__progress-fill"
              style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
