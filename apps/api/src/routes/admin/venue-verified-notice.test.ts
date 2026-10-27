// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  cleanupVenuesBySlugPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'venue-verified-notice-'

describe('A venue owner is told about verification', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let ownerId: string
  const slug = `${PREFIX}club`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
    })
    ownerId = owner.id
    await prisma.venue.create({
      data: { slug, name: 'Kellari', address: '1 Test St', city: 'Helsinki', createdBy: ownerId },
    })
  })

  afterAll(async () => {
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const post = (action: 'verify' | 'unverify') =>
    app.inject({
      method: 'POST',
      url: `/api/admin/venues/${slug}/${action}`,
      headers: { cookie: boardCookie },
    })

  const titles = async () =>
    (
      await prisma.notification.findMany({
        where: { userId: ownerId, type: 'VENUE_VERIFIED' },
        orderBy: { createdAt: 'asc' },
      })
    ).map((n) => n.title)

  it('notifies once per change, not for a repeat', async () => {
    expect((await post('verify')).statusCode).toBe(200)
    expect((await post('verify')).statusCode).toBe(200)
    expect(await titles()).toEqual(['Kellari is now a verified venue'])

    expect((await post('unverify')).statusCode).toBe(200)
    expect((await post('unverify')).statusCode).toBe(200)
    expect(await titles()).toEqual([
      'Kellari is now a verified venue',
      'Kellari is no longer verified',
    ])
  })
})
