// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('./email.js', () => ({ sendMail }))

import { prisma } from '@tahti/db'
import { recordPurchasePayment } from './purchase-tiers.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../test/helpers.js'

const PREFIX = 'purchase-notice-'

describe('a paid purchase tells the artist', () => {
  let artistId: string
  let buyerId: string
  let tierId: string

  const notes = () =>
    prisma.notification.findMany({
      where: { userId: artistId, type: 'NEW_PURCHASE' },
      select: { title: true, url: true },
    })

  const purchase = () =>
    prisma.purchase.create({
      data: { tierId, buyerUserId: buyerId, artistUserId: artistId, amountCents: 0 },
    })

  beforeAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    const buyer = await createTestArtist(prisma, {
      email: `${PREFIX}buyer@example.com`,
      username: `${PREFIX}buyer`,
      displayName: 'Buyer',
    })
    artistId = artist.id
    buyerId = buyer.id
    tierId = (
      await prisma.purchaseTier.create({
        data: { artistUserId: artistId, name: 'Drift EP', priceCents: 800 },
      })
    ).id
  })

  afterAll(async () => {
    await prisma.purchase.deleteMany({ where: { artistUserId: artistId } })
    await prisma.purchaseTier.deleteMany({ where: { artistUserId: artistId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('announces a paid purchase once, even if the webhook is retried', async () => {
    const paid = await purchase()
    const args = { purchaseId: paid.id, amountCents: 800, stripeCheckoutSessionId: `cs_${paid.id}` }
    await recordPurchasePayment(prisma, args)
    await recordPurchasePayment(prisma, args)
    expect(await notes()).toEqual([
      { title: 'Buyer bought Drift EP (€8.00)', url: '/studio/revenue' },
    ])
  })

  it('stays quiet for a free claim', async () => {
    const free = await purchase()
    await recordPurchasePayment(prisma, {
      purchaseId: free.id,
      amountCents: 0,
      stripeCheckoutSessionId: null,
    })
    expect(await notes()).toHaveLength(1)
  })
})
