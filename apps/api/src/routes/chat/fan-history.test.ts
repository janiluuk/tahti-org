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

const PREFIX = 'chat-fan-history-'

describe('GET /api/chat/:slug/fan-history', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const slug = 'chat-fan-history-artist'
  let artistCookie: string
  let strangerCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: slug,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98397,
    })
    artistCookie = await sessionCookieFor(prisma, artist.id)
    await prisma.fanTier.create({
      data: { artistUserId: artist.id, name: 'Supporter', amountCents: 500, perks: ['FAN_CHAT'] },
    })
    const stranger = await prisma.user.create({
      data: {
        email: `${PREFIX}stranger@example.com`,
        passwordHash: 'x',
        username: 'chat-fan-history-stranger',
        displayName: 'Stranger',
      },
    })
    strangerCookie = await sessionCookieFor(prisma, stranger.id)

    const channel = await prisma.channel.findUniqueOrThrow({ where: { slug } })
    await prisma.chatMessage.createMany({
      data: [
        { channelId: channel.id, handle: 'Aino', text: 'public hello', fanOnly: false },
        { channelId: channel.id, handle: 'Ville', text: 'fans only hello', fanOnly: true },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns only fan-room messages to the artist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/chat/${slug}/fan-history`,
      headers: { cookie: artistCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().messages).toEqual([
      expect.objectContaining({ handle: 'Ville', text: 'fans only hello' }),
    ])
  })

  it('refuses listeners without fan chat and anonymous callers', async () => {
    const stranger = await app.inject({
      method: 'GET',
      url: `/api/chat/${slug}/fan-history`,
      headers: { cookie: strangerCookie },
    })
    expect(stranger.statusCode).toBe(403)
    const anon = await app.inject({ method: 'GET', url: `/api/chat/${slug}/fan-history` })
    expect(anon.statusCode).toBe(401)
  })
})
