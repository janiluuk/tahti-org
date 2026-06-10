// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  parseTahtiRadioStreamMode,
  resolveActiveRadioPlayback,
  resolveTahtiRadioStream,
} from './tahti-radio.js'

describe('parseTahtiRadioStreamMode', () => {
  it('defaults to video', () => {
    expect(parseTahtiRadioStreamMode(undefined)).toBe('video')
    expect(parseTahtiRadioStreamMode('')).toBe('video')
  })

  it('accepts audio', () => {
    expect(parseTahtiRadioStreamMode('audio')).toBe('audio')
    expect(parseTahtiRadioStreamMode(' AUDIO ')).toBe('audio')
  })
})

describe('resolveTahtiRadioStream', () => {
  it('uses video URL aliases and default DJ set', () => {
    const config = resolveTahtiRadioStream({})
    expect(config.mode).toBe('video')
    expect(config.videoEmbedUrl).toContain('youtube-nocookie.com/embed/')
    expect(config.audioUrl).toBeNull()
  })

  it('reads audio HLS URL', () => {
    const config = resolveTahtiRadioStream({
      TAHTI_RADIO_STREAM_MODE: 'audio',
      TAHTI_RADIO_AUDIO_URL: 'https://stream.example/hls/live.m3u8',
    })
    expect(config.mode).toBe('audio')
    expect(config.audioUrl).toBe('https://stream.example/hls/live.m3u8')
  })
})

describe('resolveActiveRadioPlayback', () => {
  const videoConfig = resolveTahtiRadioStream({
    TAHTI_RADIO_VIDEO_URL: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })

  it('prefers video in video mode', () => {
    const playback = resolveActiveRadioPlayback(videoConfig)
    expect(playback.kind).toBe('video')
    if (playback.kind === 'video') {
      expect(playback.embedUrl).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
    }
  })

  it('falls back to audio when video mode has no embed', () => {
    const playback = resolveActiveRadioPlayback({
      mode: 'video',
      videoWatchUrl: 'not-a-video-url',
      videoEmbedUrl: null,
      audioUrl: 'https://stream.example/live.m3u8',
    })
    expect(playback).toEqual({ kind: 'audio', audioUrl: 'https://stream.example/live.m3u8' })
  })

  it('prefers audio in audio mode', () => {
    const playback = resolveActiveRadioPlayback({
      mode: 'audio',
      videoWatchUrl: null,
      videoEmbedUrl: null,
      audioUrl: 'https://stream.example/live.m3u8',
    })
    expect(playback).toEqual({ kind: 'audio', audioUrl: 'https://stream.example/live.m3u8' })
  })
})
