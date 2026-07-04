// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'obs-preset-'

describe('GET /api/me/obs-preset', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string
  let channelSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'obs-preset-user',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98543,
    })
    userId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
    channelSlug = (
      await prisma.channel.findUniqueOrThrow({
        where: { userId: artist.id },
        select: { slug: true },
      })
    ).slug
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/obs-preset' })
    expect(res.statusCode).toBe(401)
  })

  it('returns server/key, recommended settings, and a valid scene collection JSON', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/obs-preset',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(body.server).toMatch(/^rtmp:\/\//)
    expect(typeof body.streamKey).toBe('string')
    expect(body.streamKey.length).toBeGreaterThan(0)

    expect(body.recommended).toMatchObject({
      audioCodec: 'AAC',
      audioBitrateKbps: 128,
      videoCodec: 'x264',
      videoBitrateKbps: 2500,
    })

    expect(body.sceneCollectionFilename).toBe(`tahti-${channelSlug}-scene.json`)
    expect(body.sceneCollection.name).toContain(channelSlug)
    const sceneSource = body.sceneCollection.sources.find((s: { id: string }) => s.id === 'scene')
    expect(sceneSource).toBeTruthy()
    const titleSource = body.sceneCollection.sources.find(
      (s: { name: string }) => s.name === 'Title',
    )
    expect(titleSource.settings.text.length).toBeGreaterThan(0)
  })

  it('omits the cover-art image source when the user has no avatar', async () => {
    await prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } })
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/obs-preset',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const imageSource = body.sceneCollection.sources.find(
      (s: { id: string }) => s.id === 'image_source',
    )
    expect(imageSource).toBeUndefined()
  })
})
