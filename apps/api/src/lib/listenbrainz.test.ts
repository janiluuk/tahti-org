// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { submitListenBrainzListen, validateListenBrainzToken } from './listenbrainz.js'

describe('listenbrainz', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('validateListenBrainzToken', () => {
    it('returns userName when the token is valid', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ valid: true, user_name: 'mbid-user' }), { status: 200 }),
      )

      const result = await validateListenBrainzToken('secret-token')
      expect(result).toEqual({ ok: true, userName: 'mbid-user' })
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'https://api.listenbrainz.org/1/validate-token',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: 'Token secret-token' }),
        }),
      )
    })

    it('returns an error when the token is invalid', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ valid: false, message: 'Token invalid.' }), {
          status: 200,
        }),
      )

      const result = await validateListenBrainzToken('bad-token')
      expect(result).toEqual({ ok: false, error: 'Token invalid.' })
    })

    it('returns an error when ListenBrainz is unreachable', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('network down'))
      const result = await validateListenBrainzToken('secret-token')
      expect(result).toEqual({ ok: false, error: 'Could not reach ListenBrainz' })
    })
  })

  describe('submitListenBrainzListen', () => {
    it('posts a single listen with tahti as submission_client', async () => {
      vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))

      const result = await submitListenBrainzListen('secret-token', {
        listenedAt: 1_700_000_000,
        artistName: 'Artist',
        trackName: 'Track',
        recordingMbid: 'mbid-123',
        originUrl: 'https://artist.tahti.live#sound-item-abc',
      })

      expect(result).toEqual({ ok: true })
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'https://api.listenbrainz.org/1/submit-listens',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Token secret-token' }),
        }),
      )
      const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit
      expect(JSON.parse(String(init.body))).toEqual({
        listen_type: 'single',
        payload: [
          {
            listened_at: 1_700_000_000,
            track_metadata: {
              artist_name: 'Artist',
              track_name: 'Track',
              additional_info: {
                submission_client: 'tahti',
                recording_mbid: 'mbid-123',
                origin_url: 'https://artist.tahti.live#sound-item-abc',
              },
            },
          },
        ],
      })
    })

    it('returns an error on non-OK response without leaking the token', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ error: 'Invalid authorization' }), { status: 401 }),
      )

      const result = await submitListenBrainzListen('secret-token', {
        listenedAt: 1,
        artistName: 'A',
        trackName: 'T',
      })
      expect(result).toEqual({ ok: false, error: 'Invalid authorization' })
      expect(JSON.stringify(result)).not.toContain('secret-token')
    })
  })
})
