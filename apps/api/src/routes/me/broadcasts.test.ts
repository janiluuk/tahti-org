import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createReadyArchiveItem,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'recorded-shows-test-'

describe('GET /api/me/broadcasts/recent', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'recorded-shows-test-artist',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    const archiveItem = await createReadyArchiveItem(prisma, artist.channel!.id, 'Published show')
    const startedAt = new Date('2026-08-17T18:00:00.000Z')

    await prisma.broadcast.createMany({
      data: [
        {
          channelId: artist.channel!.id,
          source: 'ICECAST',
          title: 'Published broadcast',
          startedAt,
          endedAt: new Date('2026-08-17T19:00:00.000Z'),
          recordingKey: 'recordings/published.wav',
          archiveItemId: archiveItem.id,
        },
        {
          channelId: artist.channel!.id,
          source: 'RTMP',
          title: 'Unpublished broadcast',
          startedAt: new Date('2026-08-16T18:00:00.000Z'),
          endedAt: new Date('2026-08-16T18:30:00.000Z'),
          recordingKey: 'recordings/unpublished.wav',
        },
        {
          channelId: artist.channel!.id,
          source: 'WEBRTC',
          title: 'Not recorded',
          startedAt: new Date('2026-08-15T18:00:00.000Z'),
          endedAt: new Date('2026-08-15T18:10:00.000Z'),
        },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists every recorded show and resolves linked archive details', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/me/broadcasts/recent?limit=50',
      headers: { cookie },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().broadcasts).toEqual([
      expect.objectContaining({
        title: 'Published broadcast',
        archiveItemTitle: 'Published show',
        archiveItemStatus: 'READY',
        durationSec: 3600,
      }),
      expect.objectContaining({ title: 'Unpublished broadcast', durationSec: 1800 }),
    ])
  })

  it('can restrict the list to recordings that still need publishing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/me/broadcasts/recent?limit=50&unpublished=true',
      headers: { cookie },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().broadcasts).toEqual([
      expect.objectContaining({ title: 'Unpublished broadcast', archiveItemId: null }),
    ])
  })
})
