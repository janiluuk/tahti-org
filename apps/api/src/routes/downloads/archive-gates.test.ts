// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { sessionCookieFor } from '../../test/helpers.js'

const PREFIX = 'gate-test-'
const SLUG = 'gate-test-channel'
const TEST_IP = '203.0.113.77'
const dlHeaders = { 'x-forwarded-for': TEST_IP }

describe('M22 — repost/follow download gates', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let channelId: string
  let artistUserId: string
  let artistUsername: string
  let itemId: string
  let gatedItemId: string
  let listenerCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const passwordHash = await hashPassword('testpassword')
    const artist = await prisma.user.create({
      data: {
        email: `${PREFIX}artist@example.com`,
        passwordHash,
        username: 'gate-test-artist',
        displayName: 'Gate Artist',
        emailVerifiedAt: new Date(),
        isMember: true,
        channel: {
          create: {
            slug: SLUG,
            liveSourceMount: `/live/${SLUG}`,
            liveSourcePass: 'x',
            liveSourcePassHash: 'x',
            rtmpStreamKey: `${SLUG}__x`,
            rtmpStreamKeyHash: 'x',
          },
        },
      },
      include: { channel: true },
    })
    artistUserId = artist.id
    artistUsername = artist.username
    channelId = artist.channel!.id

    const open = await prisma.archiveItem.create({
      data: {
        channelId,
        title: 'Open mix',
        rawKey: 'raw/open.wav',
        mp3Key: 'mp3/open.mp3',
        fileSizeBytes: BigInt(1_000_000),
        status: 'READY',
        isPublic: true,
      },
    })
    itemId = open.id

    const gated = await prisma.archiveItem.create({
      data: {
        channelId,
        title: 'Gated mix',
        rawKey: 'raw/gated.wav',
        mp3Key: 'mp3/gated.mp3',
        fileSizeBytes: BigInt(1_000_000),
        status: 'READY',
        isPublic: true,
        repostToDownload: true,
        followToDownload: true,
      },
    })
    gatedItemId = gated.id

    const listener = await prisma.user.create({
      data: {
        email: `${PREFIX}listener@example.com`,
        passwordHash,
        username: 'gate-test-listener',
        displayName: 'Listener',
        emailVerifiedAt: new Date(),
      },
    })
    listenerCookie = await sessionCookieFor(prisma, listener.id)
  })

  afterAll(async () => {
    await prisma.download.deleteMany({ where: { channelId } })
    await prisma.archiveRepostAck.deleteMany({
      where: { archiveItemId: { in: [itemId, gatedItemId] } },
    })
    await prisma.artistFollow.deleteMany({ where: { artistUserId } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
  })

  it('blocks download until repost and follow requirements are met', async () => {
    const blocked = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${SLUG}/archive/${gatedItemId}/download?fp=gate-fp-1`,
      headers: dlHeaders,
    })
    expect(blocked.statusCode).toBe(403)

    const gateLog = await prisma.download.count({
      where: { archiveItemId: gatedItemId, reason: { in: ['gate_repost', 'gate_follow'] } },
    })
    expect(gateLog).toBeGreaterThanOrEqual(1)

    await app.inject({
      method: 'POST',
      url: `/api/v1/c/${SLUG}/archive/${gatedItemId}/repost-ack`,
      payload: { fp: 'gate-fp-1' },
    })

    const stillBlocked = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${SLUG}/archive/${gatedItemId}/download?fp=gate-fp-1`,
      headers: dlHeaders,
    })
    expect(stillBlocked.statusCode).toBe(403)

    await app.inject({
      method: 'POST',
      url: `/api/v1/artists/${artistUsername}/follow`,
      headers: { cookie: listenerCookie },
    })

    const ok = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${SLUG}/archive/${gatedItemId}/download?fp=gate-fp-1`,
      headers: { ...dlHeaders, cookie: listenerCookie },
    })
    expect(ok.statusCode).toBe(200)
  })
})
