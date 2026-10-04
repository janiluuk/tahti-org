// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { buildApp } from '../../server.js'

const RADIO_HELSINKI_PAGE = `
  <div class="program-name current-program-title">CADIA</div>
  <div class="artist current-song-artist">Bloc Party</div>
  <div class="title current-song-title">Positive Tension</div>
`

describe('GET /api/v1/internet-radio/now-playing', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const get = (url: string) =>
    app.inject({
      method: 'GET',
      url: `/api/v1/internet-radio/now-playing?url=${encodeURIComponent(url)}`,
    })

  it("reads the programme and track from a known station's page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(RADIO_HELSINKI_PAGE))
    vi.stubGlobal('fetch', fetchMock)

    const res = await get('https://www.radiohelsinki.fi/ohjelmakartta/')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ title: 'CADIA', artist: 'Bloc Party — Positive Tension' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://www.radiohelsinki.fi/ohjelmakartta/')
  })

  it('answers with empty fields when the page cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const res = await get('https://www.radioplay.fi/nrj')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ title: null, artist: null })
  })

  it('never fetches an address it has no parser for', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    for (const url of [
      'https://example.com/',
      'http://169.254.169.254/latest/meta-data/',
      'http://www.radiohelsinki.fi/ohjelmakartta/',
      'https://www.radiohelsinki.fi.evil.example/',
    ]) {
      expect((await get(url)).statusCode, url).toBe(404)
    }
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/internet-radio/now-playing' })).statusCode,
    ).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
