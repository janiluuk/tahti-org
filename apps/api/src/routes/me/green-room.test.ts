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

const PREFIX = 'green-room-'

describe('Green room API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistCookie: string
  let guestCookie: string
  let channelId: string
  let channelSlug: string
  let broadcastId: string
  let guestUserId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'green-room-artist',
    })
    const guest = await createTestArtist(prisma, {
      email: `${PREFIX}guest@example.com`,
      username: 'green-room-guest',
    })
    guestUserId = guest.id

    artistCookie = await sessionCookieFor(prisma, artist.id)
    guestCookie = await sessionCookieFor(prisma, guest.id)

    const channel = await prisma.channel.findUniqueOrThrow({
      where: { userId: artist.id },
      select: { id: true, slug: true },
    })
    channelId = channel.id
    channelSlug = channel.slug

    await prisma.channel.update({
      where: { id: channelId },
      data: {
        greenRoomDefaultEnabled: true,
        greenRoomDefaultInvitePool: 'MANUAL_ONLY',
        state: 'PREVIEW',
      },
    })

    const broadcast = await prisma.broadcast.create({
      data: { channelId, source: 'RTMP', greenRoomEnabled: true },
    })
    broadcastId = broadcast.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns channel green room defaults', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/channel/green-room-defaults',
      headers: { cookie: artistCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      defaultEnabled: true,
      defaultInvitePool: 'MANUAL_ONLY',
    })
  })

  it('lets the artist invite, join-check, and remove a guest', async () => {
    const invite = await app.inject({
      method: 'POST',
      url: '/api/me/channel/green-room/invites',
      headers: { cookie: artistCookie },
      payload: { username: 'green-room-guest' },
    })
    expect(invite.statusCode).toBe(201)

    const access = await app.inject({
      method: 'GET',
      url: `/api/me/green-room/${channelSlug}`,
      headers: { cookie: guestCookie },
    })
    expect(access.statusCode).toBe(200)
    expect(access.json()).toMatchObject({ hasAccess: true, channelState: 'PREVIEW' })

    const join = await app.inject({
      method: 'POST',
      url: `/api/me/green-room/${channelSlug}/join`,
      headers: { cookie: guestCookie },
    })
    expect(join.statusCode).toBe(200)
    expect(join.json().joinedAt).toBeTruthy()
    expect(join.json().hlsUrl).toContain(channelSlug)

    const remove = await app.inject({
      method: 'DELETE',
      url: `/api/me/channel/green-room/invites/${guestUserId}`,
      headers: { cookie: artistCookie },
    })
    expect(remove.statusCode).toBe(204)

    const afterRemove = await app.inject({
      method: 'GET',
      url: `/api/me/green-room/${channelSlug}`,
      headers: { cookie: guestCookie },
    })
    expect(afterRemove.json().hasAccess).toBe(false)
  })

  it('reports session state to the artist', async () => {
    await prisma.broadcastGreenRoomInvite.deleteMany({ where: { broadcastId } })

    const session = await app.inject({
      method: 'GET',
      url: '/api/me/channel/green-room',
      headers: { cookie: artistCookie },
    })
    expect(session.statusCode).toBe(200)
    expect(session.json()).toMatchObject({
      enabled: true,
      channelState: 'PREVIEW',
      invitePool: 'MANUAL_ONLY',
    })
  })
})
