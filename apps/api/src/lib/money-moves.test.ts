// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('./email.js', () => ({ sendMail }))

import { prisma } from '@tahti/db'
import { activateSubscription } from './fansub.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../test/helpers.js'

const PREFIX = 'money-moves-'

describe('a new fan subscription tells the artist', () => {
  let artistId: string
  let fanIds: string[]

  const notes = () =>
    prisma.notification.findMany({
      where: { userId: artistId, type: 'NEW_FAN_SUBSCRIBER' },
      select: { title: true, url: true },
      orderBy: { createdAt: 'asc' },
    })

  const subscribe = (fanId: string) =>
    activateSubscription(prisma, {
      artistUserId: artistId,
      subscriberUserId: fanId,
      tierName: 'Insider',
      amountCents: 500,
      stripeSubscriptionId: `test_${fanId}`,
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
    })

  beforeAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    artistId = artist.id
    await prisma.user.update({ where: { id: artistId }, data: { emailVerifiedAt: new Date() } })
    fanIds = []
    for (const n of [1, 2, 3]) {
      const fan = await createTestArtist(prisma, {
        email: `${PREFIX}fan${n}@example.com`,
        username: `${PREFIX}fan${n}`,
        displayName: `Fan ${n}`,
      })
      fanIds.push(fan.id)
    }
  })

  beforeEach(() => sendMail.mockClear())

  afterAll(async () => {
    await prisma.fanSubscription.deleteMany({ where: { artistUserId: artistId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('notifies in-app and by email on the first activation only', async () => {
    await subscribe(fanIds[0]!)
    await subscribe(fanIds[0]!)
    expect(await notes()).toEqual([
      { title: 'Fan 1 subscribed (Insider, €5.00/mo)', url: '/studio/revenue' },
    ])
    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(sendMail.mock.calls[0]![0]).toMatchObject({
      to: `${PREFIX}artist@example.com`,
      subject: 'Tahti · Fan 1 subscribed (Insider, €5.00/mo)',
    })
  })

  it('honours the Money moves switches', async () => {
    await prisma.user.update({
      where: { id: artistId },
      data: { notifyMoneyMovesInApp: false, notifyMoneyMovesEmail: true },
    })
    await subscribe(fanIds[1]!)
    expect(await notes()).toHaveLength(1)
    expect(sendMail).toHaveBeenCalledTimes(1)

    await prisma.user.update({
      where: { id: artistId },
      data: { notifyMoneyMovesInApp: true, notifyMoneyMovesEmail: false },
    })
    sendMail.mockClear()
    await subscribe(fanIds[2]!)
    expect(await notes()).toHaveLength(2)
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('never fails the activation when the email cannot be sent', async () => {
    await prisma.fanSubscription.deleteMany({ where: { artistUserId: artistId } })
    await prisma.user.update({
      where: { id: artistId },
      data: { notifyMoneyMovesEmail: true },
    })
    sendMail.mockRejectedValueOnce(new Error('SMTP down'))
    await expect(subscribe(fanIds[0]!)).resolves.toMatchObject({ state: 'ACTIVE' })
  })
})
