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

const PREFIX = 'export-tiers-'

describe('GET /api/me/data-export.json — fan tiers and store items', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    await prisma.fanTier.create({
      data: {
        artistUserId: artist.id,
        name: 'Supporter',
        amountCents: 500,
        perks: ['Early access'],
      },
    })
    const tier = await prisma.purchaseTier.create({
      data: { artistUserId: artist.id, name: 'Album', priceCents: 900 },
    })
    await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: 'Side A',
        status: 'READY',
        purchaseTierId: tier.id,
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists the tiers and store items the artist offers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.fanTiers).toEqual([
      expect.objectContaining({ name: 'Supporter', amountCents: 500, perks: ['Early access'] }),
    ])
    expect(body.storeItems).toEqual([
      expect.objectContaining({
        name: 'Album',
        priceCents: 900,
        sounds: [expect.objectContaining({ title: 'Side A' })],
      }),
    ])
  })
})
