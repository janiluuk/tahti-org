// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { parseVideoEmbedUrl } from './video-embed.js'

/** Channel slug for Tahti Radio chat + reactions (seeded via apps/api/scripts/seed-tahti-radio.ts). */
export const TAHTI_RADIO_SLUG = 'tahti-radio'

/** Default 24/7 placeholder video — override with TAHTI_RADIO_VIDEO_URL. */
export const TAHTI_RADIO_DEFAULT_VIDEO_URL = 'https://www.youtube.com/watch?v=21qNnsSibLY'

/** @deprecated Use TAHTI_RADIO_DEFAULT_VIDEO_URL */
export const TAHTI_RADIO_DEFAULT_YOUTUBE_URL = TAHTI_RADIO_DEFAULT_VIDEO_URL

export type TahtiRadioStreamMode = 'video' | 'audio'

export type TahtiRadioStreamEnv = {
  TAHTI_RADIO_STREAM_MODE?: string
  /** YouTube/Vimeo watch URL for video mode */
  TAHTI_RADIO_VIDEO_URL?: string
  /** Legacy alias for TAHTI_RADIO_VIDEO_URL */
  TAHTI_RADIO_YOUTUBE_URL?: string
  /** HLS (.m3u8) URL for audio mode */
  TAHTI_RADIO_AUDIO_URL?: string
  /** Legacy alias for TAHTI_RADIO_AUDIO_URL */
  TAHTI_RADIO_HLS_URL?: string
}

export type TahtiRadioStreamConfig = {
  mode: TahtiRadioStreamMode
  videoWatchUrl: string | null
  videoEmbedUrl: string | null
  audioUrl: string | null
}

export type ActiveRadioPlayback =
  | { kind: 'video'; embedUrl: string }
  | { kind: 'audio'; audioUrl: string }
  | { kind: 'none' }

/** Parse TAHTI_RADIO_STREAM_MODE — defaults to video. */
export function parseTahtiRadioStreamMode(raw: string | undefined): TahtiRadioStreamMode {
  const value = raw?.trim().toLowerCase()
  if (value === 'audio') return 'audio'
  return 'video'
}

/** Parse a watch URL into an iframe embed URL with player-friendly query params. */
export function resolveRadioVideoEmbedUrl(url: string): string | null {
  const embed = parseVideoEmbedUrl(url)
  if (!embed) return null
  const suffix =
    embed.provider === 'youtube'
      ? '?autoplay=1&mute=1&controls=1&playsinline=1&rel=0'
      : '?background=0&autoplay=1&muted=1&controls=1'
  return `${embed.embedUrl}${suffix}`
}

/** @deprecated Use resolveRadioVideoEmbedUrl */
export const resolveRadioYoutubeEmbedUrl = resolveRadioVideoEmbedUrl

/** Resolve radio stream settings from deployment env. */
export function resolveTahtiRadioStream(env: TahtiRadioStreamEnv): TahtiRadioStreamConfig {
  const mode = parseTahtiRadioStreamMode(env.TAHTI_RADIO_STREAM_MODE)
  const videoWatchUrl =
    env.TAHTI_RADIO_VIDEO_URL?.trim() ||
    env.TAHTI_RADIO_YOUTUBE_URL?.trim() ||
    TAHTI_RADIO_DEFAULT_VIDEO_URL
  const videoEmbedUrl = resolveRadioVideoEmbedUrl(videoWatchUrl)
  const audioUrl = env.TAHTI_RADIO_AUDIO_URL?.trim() || env.TAHTI_RADIO_HLS_URL?.trim() || null

  return { mode, videoWatchUrl, videoEmbedUrl, audioUrl }
}

/** Pick the stream to play, honoring mode with cross-fallback when the preferred source is missing. */
export function resolveActiveRadioPlayback(config: TahtiRadioStreamConfig): ActiveRadioPlayback {
  if (config.mode === 'video') {
    if (config.videoEmbedUrl) return { kind: 'video', embedUrl: config.videoEmbedUrl }
    if (config.audioUrl) return { kind: 'audio', audioUrl: config.audioUrl }
    return { kind: 'none' }
  }

  if (config.audioUrl) return { kind: 'audio', audioUrl: config.audioUrl }
  if (config.videoEmbedUrl) return { kind: 'video', embedUrl: config.videoEmbedUrl }
  return { kind: 'none' }
}
