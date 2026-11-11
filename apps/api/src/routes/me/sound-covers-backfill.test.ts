// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'sound-covers-backfill-'
const MIXCLOUD_COVER = 'https://thumbnailer.mixcloud.com/unsafe/640x640/mix.jpg'
const SPOTIFY_COVER = 'https://i.scdn.co/image/ab67616d00001e02cover'

function providerFetch(input: string | URL | Request): Promise<Response> {
  const url = String(input instanceof Request ? input.url : input)
  if (url.startsWith('https://api.mixcloud.com/dj/night-mix/')) {
    return Promise.resolve(Response.json({ pictures: { '640wx640h': MIXCLOUD_COVER } }))
  }
  if (url.startsWith('https://open.spotify.com/oembed')) {
    return Promise.resolve(Response.json({ thumbnail_url: SPOTIFY_COVER }))
  }
  return Promise.resolve(new Response('not found', { status: 404 }))
}

describe('POST /api/me/sound/covers/backfill with provider covers', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    channelId = artist.channel!.id
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  async function embed(title: string, data: Record<string, unknown>) {
    const sound = await createReadySound(prisma, channelId, title)
    await prisma.sound.update({
      where: { id: sound.id },
      data: { contentType: 'EMBED', bannerUrl: null, ...data },
    })
    return sound.id
  }

  it('stores the Mixcloud and Spotify covers and gives the rest a preset', async () => {
    await prisma.artworkPreset.deleteMany({})
    await prisma.artworkPreset.create({
      data: { url: '/presets/cover-a.png', enabled: true, position: 0 },
    })
    const mixcloud = await embed('Night Mix', {
      embedProvider: 'MIXCLOUD',
      embedUri: 'https://www.mixcloud.com/dj/night-mix/',
    })
    const spotify = await embed('Single', {
      embedProvider: 'SPOTIFY',
      embedUri: 'spotify:track:4cOdK2wGLETKBW3PvgPWqT',
    })
    const mikseri = await embed('Mikseri song', {
      embedProvider: 'MIKSERI',
      embedUri: 'https://www.mikseri.net/embed/?type=1&parameter=123',
    })
    const fetchMock = vi.fn(providerFetch)
    vi.stubGlobal('fetch', fetchMock)

    const res = await app.inject({
      method: 'POST',
      url: '/api/me/sound/covers/backfill',
      headers: { cookie },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ assigned: 3, totalMatched: 3 })
    const rows = await prisma.sound.findMany({
      where: { id: { in: [mixcloud, spotify, mikseri] } },
      select: { id: true, bannerUrl: true },
    })
    const cover = Object.fromEntries(rows.map((r) => [r.id, r.bannerUrl]))
    expect(cover[mixcloud]).toBe(MIXCLOUD_COVER)
    expect(cover[spotify]).toBe(SPOTIFY_COVER)
    expect(cover[mikseri]).toMatch(/\/presets\/cover-a\.png$/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falls back to a preset when the provider is down', async () => {
    const sound = await embed('Unreachable mix', {
      embedProvider: 'MIXCLOUD',
      embedUri: 'https://www.mixcloud.com/dj/gone/',
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const res = await app.inject({
      method: 'POST',
      url: '/api/me/sound/covers/backfill',
      headers: { cookie },
    })

    expect(res.statusCode).toBe(200)
    const row = await prisma.sound.findUniqueOrThrow({ where: { id: sound } })
    expect(row.bannerUrl).toMatch(/\/presets\/cover-a\.png$/)
  })
})
