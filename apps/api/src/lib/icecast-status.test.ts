// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { parseIcecastMountStatus } from './icecast-status.js'

describe('parseIcecastMountStatus', () => {
  it('returns not-connected when no source matches the mount', () => {
    const body = { icestats: { source: [] } }
    expect(parseIcecastMountStatus(body, '/live/artist')).toEqual({
      connected: false,
      codec: null,
      bitrateKbps: null,
      listeners: null,
    })
  })

  it('returns not-connected when icestats has no source at all', () => {
    expect(parseIcecastMountStatus({ icestats: {} }, '/live/artist')).toEqual({
      connected: false,
      codec: null,
      bitrateKbps: null,
      listeners: null,
    })
  })

  it('parses a single source object (not wrapped in an array)', () => {
    const body = {
      icestats: {
        source: {
          listenurl: 'http://ingest.tahti.live:8000/live/artist',
          server_type: 'audio/mpeg',
          bitrate: 128,
          listeners: 3,
        },
      },
    }
    expect(parseIcecastMountStatus(body, '/live/artist')).toEqual({
      connected: true,
      codec: 'MP3',
      bitrateKbps: 128,
      listeners: 3,
    })
  })

  it('matches the right mount among multiple sources', () => {
    const body = {
      icestats: {
        source: [
          {
            listenurl: 'http://ingest.tahti.live:8000/live/other-artist',
            server_type: 'audio/mpeg',
            bitrate: 96,
          },
          {
            listenurl: 'http://ingest.tahti.live:8000/live/artist',
            server_type: 'application/ogg',
            audio_info: 'samplerate=44100;channels=2;bitrate=192',
            listeners: 7,
          },
        ],
      },
    }
    expect(parseIcecastMountStatus(body, '/live/artist')).toEqual({
      connected: true,
      codec: 'Ogg Vorbis',
      bitrateKbps: 192,
      listeners: 7,
    })
  })

  it('falls back to the raw server_type when no friendly label is known', () => {
    const body = {
      icestats: {
        source: {
          listenurl: 'http://ingest.tahti.live:8000/live/artist',
          server_type: 'application/x-mystery',
          bitrate: 64,
        },
      },
    }
    expect(parseIcecastMountStatus(body, '/live/artist').codec).toBe('application/x-mystery')
  })
})
