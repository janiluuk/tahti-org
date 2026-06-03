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
import { hashPassword } from '../../lib/password.js'

const PREFIX = 'chat-token-supporter-'

describe('POST /api/chat/:slug/token — supporter badge', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistSlug: string
  let fanCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    artistSlug = 'chat-token-artist'
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: artistSlug,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98520,
    })

    const passwordHash = await hashPassword('testpassword')
    const fan = await prisma.user.create({
      data: {
        email: `${PREFIX}fan@example.com`,
        passwordHash,
        username: 'chat-token-fan',
        displayName: 'Chat Fan',
        emailVerifiedAt: new Date(),
        isMember: true,
      },
    })
    fanCookie = await sessionCookieFor(prisma, fan.id)

    await prisma.fanSubscription.create({
      data: {
        artistUserId: artist.id,
        subscriberUserId: fan.id,
        tierName: 'Supporter',
        amountCents: 500,
        stripeSubscriptionId: `sub_${PREFIX}1`,
        state: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns supporter: false for anonymous listeners', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/chat/${artistSlug}/token`,
      payload: { handle: 'anon-listener' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().supporter).toBe(false)
    expect(res.json().token).toBeTruthy()
  })

  it('returns supporter: true when session user is an active fan subscriber', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/chat/${artistSlug}/token`,
      headers: { cookie: fanCookie },
      payload: { handle: 'super-fan' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().supporter).toBe(true)
    expect(res.json().handle).toBe('super-fan')
  })

  it('returns 400 when handle is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/chat/${artistSlug}/token`,
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })
})
