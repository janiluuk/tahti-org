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

const PREFIX = 'sound-share-notice-'

describe('Sharing a track with a member tells them', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let soundId: string
  let friendId: string
  let blockerId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'DJ Kaski',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    const friend = await createTestArtist(prisma, {
      email: `${PREFIX}friend@example.com`,
      username: `${PREFIX}friend`,
    })
    friendId = friend.id
    const blocker = await createTestArtist(prisma, {
      email: `${PREFIX}blocker@example.com`,
      username: `${PREFIX}blocker`,
    })
    blockerId = blocker.id
    await prisma.userBlock.create({ data: { blockerUserId: blocker.id, blockedUserId: artist.id } })
    const sound = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: 'Unreleased',
        status: 'READY',
        isPublic: false,
      },
    })
    soundId = sound.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const share = (granteeUsername: string) =>
    app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/share`,
      headers: { cookie },
      payload: { granteeUsername },
    })

  it('notifies the grantee with the keyed link', async () => {
    const res = await share(`${PREFIX}friend`)
    expect(res.statusCode).toBe(201)
    const [notice] = await prisma.notification.findMany({
      where: { userId: friendId, type: 'TRACK_SHARED' },
    })
    expect(notice?.title).toBe('DJ Kaski shared "Unreleased" with you')
    expect(notice?.url).toMatch(new RegExp(`^/t/${soundId}\\?key=`))
  })

  it('stays quiet when the grantee blocked the artist', async () => {
    expect((await share(`${PREFIX}blocker`)).statusCode).toBe(201)
    expect(
      await prisma.notification.count({ where: { userId: blockerId, type: 'TRACK_SHARED' } }),
    ).toBe(0)
  })
})
