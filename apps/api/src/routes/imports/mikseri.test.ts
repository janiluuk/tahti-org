// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'mikseri-import-test-'

describe('Mikseri embed import', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string
  let collectionId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      tier: 'ARTIST',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    userId = artist.id
    const collection = await prisma.collection.create({
      data: { userId, name: 'Mikseri imports', slug: `${PREFIX}collection` },
    })
    collectionId = collection.id
  })

  afterAll(async () => {
    await prisma.collectionItem.deleteMany({ where: { collectionId } })
    await prisma.collection.deleteMany({ where: { userId } })
    await prisma.sound.deleteMany({ where: { channel: { userId } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('adds an official track reference without local media', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/imports/mikseri/add',
      headers: { cookie },
      payload: {
        collectionId,
        trackUrl: 'https://mikseri.net/artists/example/demo.635878/',
        title: 'Demo song',
        artistName: 'Demo artist',
        genre: 'Electronic',
        rightsConfirmed: true,
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    const sound = await prisma.sound.findUniqueOrThrow({ where: { id: body.soundId } })
    expect(sound).toMatchObject({
      source: 'URL_EMBED',
      qualityBadge: 'EMBED_ONLY',
      contentType: 'EMBED',
      embedProvider: 'MIKSERI',
      embedUri: 'https://www.mikseri.net/embed/?type=1&parameter=635878',
      rawKey: null,
      mp3Key: null,
      flacKey: null,
    })
  })

  it('requires a track reference and explicit rights confirmation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/imports/mikseri/add',
      headers: { cookie },
      payload: {
        collectionId,
        trackUrl: 'https://mikseri.net/embed/?type=15&parameter=0',
        title: 'Listataivas',
        artistName: 'Mikseri.net',
        rightsConfirmed: false,
      },
    })
    expect(response.statusCode).toBe(400)
  })
})
