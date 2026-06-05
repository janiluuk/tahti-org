// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/stripe.js', () => ({
  stripeEnabled: true,
}))

import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'legacy-mship-'

describe('M1 — legacy subscription migration queue', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let legacyEmail: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    legacyEmail = `${PREFIX}legacy@example.com`
    await createTestArtist(prisma, {
      email: legacyEmail,
      username: 'legacy-mship-user',
      isMember: true,
      memberNumber: 98301,
    })

    await createTestArtist(prisma, {
      email: `${PREFIX}migrated@example.com`,
      username: 'legacy-mship-migrated',
      isMember: true,
      memberNumber: 98302,
    })
    await prisma.user.update({
      where: { email: `${PREFIX}migrated@example.com` },
      data: { stripeMembershipSubscriptionId: 'sub_test_migrated' },
    })

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'legacy-mship-board',
      isBoard: true,
      isMember: true,
      memberNumber: 98300,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET /api/admin/members/legacy-subscriptions requires board role', async () => {
    const member = await prisma.user.findFirst({ where: { email: legacyEmail } })
    const cookie = await sessionCookieFor(prisma, member!.id)
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/members/legacy-subscriptions',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('lists active members without Stripe subscription id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/members/legacy-subscriptions',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const rows = res.json() as Array<{ email: string; memberNumber: number }>
    expect(rows.some((r) => r.email === legacyEmail && r.memberNumber === 98301)).toBe(true)
    expect(rows.some((r) => r.email === `${PREFIX}migrated@example.com`)).toBe(false)
  })
})
