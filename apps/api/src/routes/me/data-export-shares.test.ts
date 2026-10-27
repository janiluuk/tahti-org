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

const PREFIX = 'export-shares-'

describe('GET /api/me/data-export.json — shares and green-room invites', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistCookie: string
  let friendCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    const friend = await createTestArtist(prisma, {
      email: `${PREFIX}friend@example.com`,
      username: `${PREFIX}friend`,
    })
    artistCookie = await sessionCookieFor(prisma, artist.id)
    friendCookie = await sessionCookieFor(prisma, friend.id)
    const sound = await prisma.sound.create({
      data: { channelId: artist.channel!.id, title: 'Demo', status: 'READY' },
    })
    await prisma.soundShare.create({
      data: { soundId: sound.id, granteeUsername: `${PREFIX}friend`, token: `${PREFIX}secret-key` },
    })
    const broadcast = await prisma.broadcast.create({
      data: { channelId: artist.channel!.id, startedAt: new Date(), source: 'RTMP' },
    })
    await prisma.broadcastGreenRoomInvite.create({
      data: { broadcastId: broadcast.id, userId: friend.id, source: 'MANUAL' },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const exportFor = async (cookie: string) => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).not.toContain(`${PREFIX}secret-key`)
    return res.json()
  }

  it('lists shares made, without the link key', async () => {
    const body = await exportFor(artistCookie)
    expect(body.sharesGiven).toEqual([
      expect.objectContaining({
        granteeUsername: `${PREFIX}friend`,
        sound: expect.objectContaining({ title: 'Demo' }),
      }),
    ])
  })

  it('lists shares received and green rooms the member was invited to', async () => {
    const body = await exportFor(friendCookie)
    expect(body.sharesReceived).toEqual([
      expect.objectContaining({ sound: expect.objectContaining({ title: 'Demo' }) }),
    ])
    expect(body.greenRoomInvites).toEqual([
      expect.objectContaining({
        source: 'MANUAL',
        broadcast: { channel: { slug: `${PREFIX}artist` } },
      }),
    ])
  })
})
