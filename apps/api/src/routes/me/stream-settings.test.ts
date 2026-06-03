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

const PREFIX = 'stream-rotate-'

describe('POST /api/me/stream-settings/rtmp/rotate', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'stream-rotate-user',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98540,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    channelId = (
      await prisma.channel.findUniqueOrThrow({
        where: { userId: artist.id },
        select: { id: true },
      })
    ).id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns 409 when channel is LIVE (ARTIST-002)', async () => {
    await prisma.channel.update({ where: { id: channelId }, data: { state: 'LIVE' } })

    const res = await app.inject({
      method: 'POST',
      url: '/api/me/stream-settings/rtmp/rotate',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)

    await prisma.channel.update({ where: { id: channelId }, data: { state: 'OFFLINE' } })
  })

  it('rotates key when offline', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/stream-settings/rtmp/rotate',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().rtmpStreamKey).toContain('stream-rotate-user__')
  })
})
