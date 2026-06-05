// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'chat-access-'

describe('GET /api/chat/:slug/access', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let slug: string
  let fanCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    slug = 'chat-access-artist'
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: slug,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98391,
    })

    await prisma.fanTier.create({
      data: {
        artistUserId: artist.id,
        name: 'Supporter',
        amountCents: 500,
        perks: ['FAN_CHAT'],
      },
    })

    const fan = await prisma.user.create({
      data: {
        email: `${PREFIX}fan@example.com`,
        passwordHash: await hashPassword('testpassword'),
        username: 'chat-access-fan',
        displayName: 'Fan',
        emailVerifiedAt: new Date(),
      },
    })
    fanCookie = await sessionCookieFor(prisma, fan.id)

    await prisma.fanSubscription.create({
      data: {
        artistUserId: artist.id,
        subscriberUserId: fan.id,
        tierName: 'Supporter',
        amountCents: 500,
        stripeSubscriptionId: `sub_${PREFIX}`,
        state: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns fan chat flags for anonymous users', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/chat/${slug}/access`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      fanChatEnabled: true,
      isSupporter: false,
      canJoinFanChat: false,
    })
  })

  it('returns supporter eligibility for subscribed fans', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/chat/${slug}/access`,
      headers: { cookie: fanCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      fanChatEnabled: true,
      isSupporter: true,
      canJoinFanChat: true,
    })
  })

  it('returns 404 for unknown channel', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/no-such-channel/access',
    })
    expect(res.statusCode).toBe(404)
  })
})
