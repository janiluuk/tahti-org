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

describe('stream-settings rotate', () => {
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
      memberNumber: 98542,
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

  it('POST rtmp/rotate succeeds while LIVE and keeps previous key valid (ARTIST-002)', async () => {
    const before = await prisma.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: { rtmpStreamKey: true, rtmpStreamKeyHash: true },
    })
    await prisma.channel.update({ where: { id: channelId }, data: { state: 'LIVE' } })

    const res = await app.inject({
      method: 'POST',
      url: '/api/me/stream-settings/rtmp/rotate',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const newKey = res.json().rtmpStreamKey as string
    expect(newKey).not.toBe(before.rtmpStreamKey)

    const after = await prisma.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: {
        rtmpStreamKeyPreviousHash: true,
        rtmpStreamKeyPreviousExpiresAt: true,
      },
    })
    expect(after.rtmpStreamKeyPreviousHash).toBe(before.rtmpStreamKeyHash)
    expect(after.rtmpStreamKeyPreviousExpiresAt).toBeTruthy()

    await prisma.channel.update({ where: { id: channelId }, data: { state: 'OFFLINE' } })
  })

  it('POST rtmp/rotate succeeds when offline', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/stream-settings/rtmp/rotate',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().rtmpStreamKey).toContain('stream-rotate-user__')
  })

  it('POST icecast/rotate succeeds while LIVE (ARTIST-002)', async () => {
    await prisma.channel.update({ where: { id: channelId }, data: { state: 'LIVE' } })
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/stream-settings/icecast/rotate',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().liveSourcePass).toHaveLength(24)
    await prisma.channel.update({ where: { id: channelId }, data: { state: 'OFFLINE' } })
  })
})
