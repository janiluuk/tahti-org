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

const PREFIX = 'chat-fan-token-'

describe('POST /api/chat/:slug/fan-token', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const slug = 'chat-fan-token-artist'
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
      memberNumber: 98396,
    })
    artistCookie = await sessionCookieFor(prisma, artist.id)
    await prisma.fanTier.create({
      data: { artistUserId: artist.id, name: 'Supporter', amountCents: 500, perks: ['FAN_CHAT'] },
    })
    const stranger = await prisma.user.create({
      data: {
        email: `${PREFIX}stranger@example.com`,
        passwordHash: 'x',
        username: 'chat-fan-token-stranger',
        displayName: 'Stranger',
      },
    })
    strangerCookie = await sessionCookieFor(prisma, stranger.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('gives the artist a token for their own fan room', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/chat/${slug}/fan-token`,
      headers: { cookie: artistCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ channel: `channel:${slug}:fans` })
  })

  it('refuses a signed-in listener without a fan-chat subscription', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/chat/${slug}/fan-token`,
      headers: { cookie: strangerCookie },
    })
    expect(res.statusCode).toBe(403)
  })
})
