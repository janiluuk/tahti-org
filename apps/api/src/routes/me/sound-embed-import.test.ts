// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const { mockGetTrackByUrl } = vi.hoisted(() => ({
  mockGetTrackByUrl: vi.fn(),
}))

vi.mock('@tahti/hearthis', () => ({
  createHearthisClient: () => ({
    getTrackByUrl: mockGetTrackByUrl,
  }),
}))

import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'sound-embed-import-test-'

describe('POST /api/me/sound/:id/import-embed', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'embed-import-artist',
      tier: 'ARTIST',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    channelId = artist.channel!.id
  })

  afterAll(async () => {
    await prisma.sound.deleteMany({ where: { channelId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  async function createEmbedSound(
    overrides: Partial<Parameters<typeof prisma.sound.create>[0]['data']> = {},
  ) {
    return prisma.sound.create({
      data: {
        channelId,
        title: 'Embed track',
        source: 'HEARTHIS_EMBED',
        qualityBadge: 'EMBED_ONLY',
        contentType: 'EMBED',
        embedUri: '14624101',
        embedProvider: 'HEARTHIS',
        embedSourceUrl: 'https://hearthis.at/someone/some-track/',
        status: 'READY',
        isPublic: true,
        ...overrides,
      },
    })
  }

  it('404s for a sound the caller does not own', async () => {
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'embed-import-other',
    })
    const sound = await prisma.sound.create({
      data: {
        channelId: other.channel!.id,
        title: 'Not mine',
        source: 'HEARTHIS_EMBED',
        embedUri: '1',
        embedProvider: 'HEARTHIS',
        embedSourceUrl: 'https://hearthis.at/other/track/',
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${sound.id}/import-embed`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('400s for a non-embed sound', async () => {
    const sound = await prisma.sound.create({
      data: { channelId, title: 'Regular upload', source: 'UPLOAD' },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${sound.id}/import-embed`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('409s when the item already has real audio', async () => {
    const sound = await createEmbedSound({ rawKey: 'raw/already-there.mp3' })
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${sound.id}/import-embed`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
  })

  it('409s when hearthis.at reports the track is not downloadable', async () => {
    mockGetTrackByUrl.mockResolvedValueOnce({ downloadable: '0', download_url: undefined })
    const sound = await createEmbedSound()
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${sound.id}/import-embed`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error).toMatch(/not enabled downloads/)
  })

  it('502s when hearthis.at cannot be reached', async () => {
    mockGetTrackByUrl.mockRejectedValueOnce(new Error('boom'))
    const sound = await createEmbedSound()
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${sound.id}/import-embed`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(502)
  })

  it('202s and queues localization when downloadable', async () => {
    mockGetTrackByUrl.mockResolvedValueOnce({
      downloadable: '1',
      download_url: 'https://hearthis.at/dl/track.mp3',
    })
    const sound = await createEmbedSound()
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${sound.id}/import-embed`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(202)
    expect(res.json()).toEqual({ status: 'importing' })
  })
})
