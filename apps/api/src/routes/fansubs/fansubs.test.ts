// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { config } from '../../config.js'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'
import { runAnnualGrantCalc } from '@tahti/ledger'

const PREFIX = 'fansub-test-'
const YEAR = 2032

async function makeUser(opts: {
  email: string
  username: string
  displayName: string
  withChannel?: boolean
}) {
  const passwordHash = await hashPassword('testpassword')
  return prisma.user.create({
    data: {
      email: opts.email,
      passwordHash,
      username: opts.username,
      displayName: opts.displayName,
      emailVerifiedAt: new Date(),
      isMember: true,
      ...(opts.withChannel
        ? {
            channel: {
              create: {
                slug: opts.username,
                liveSourceMount: `/live/${opts.username}`,
                liveSourcePass: 'x',
                liveSourcePassHash: 'x',
                rtmpStreamKey: `${opts.username}__x`,
                rtmpStreamKeyHash: 'x',
              },
            },
          }
        : {}),
    },
    include: { channel: true },
  })
}

describe('M19 — fan-to-artist subscriptions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artist: Awaited<ReturnType<typeof makeUser>>
  let fan: Awaited<ReturnType<typeof makeUser>>
  let artistCookie: string
  let fanCookie: string
  let tierId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanup()

    artist = await makeUser({
      email: `${PREFIX}artist@example.com`,
      username: 'fansub-artist',
      displayName: 'Fan Artist',
      withChannel: true,
    })
    fan = await makeUser({
      email: `${PREFIX}fan@example.com`,
      username: 'fansub-fan',
      displayName: 'Super Fan',
    })
    artistCookie = `tahti_session=${(await createSession(prisma, artist.id)).id}`
    fanCookie = `tahti_session=${(await createSession(prisma, fan.id)).id}`
  })

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true, channel: { select: { id: true } } },
    })
    const ids = users.map((u) => u.id)
    await prisma.fanSubPayout.deleteMany({ where: { artistUserId: { in: ids } } })
    await prisma.fanSubscription.deleteMany({ where: { artistUserId: { in: ids } } })
    await prisma.fanTier.deleteMany({ where: { artistUserId: { in: ids } } })
    for (const u of users) {
      if (u.channel) await prisma.download.deleteMany({ where: { channelId: u.channel.id } })
    }
    await prisma.grantDisbursement.deleteMany({ where: { forYear: YEAR } })
    await prisma.monthlyRollup.deleteMany({ where: { yearMonth: { startsWith: `${YEAR}-` } } })
    await prisma.ledgerEntry.deleteMany({ where: { externalRef: { contains: 'fansub:' } } })
    await prisma.ledgerEntry.deleteMany({ where: { externalRef: { contains: `:${YEAR}:` } } })
    await prisma.ledgerEntry.deleteMany({ where: { externalRef: `reserve:${YEAR}` } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
  }

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('lets an artist create a tier and exposes it publicly', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/fan-tiers',
      headers: { cookie: artistCookie },
      payload: {
        name: 'Backer',
        amountCents: 500,
        description: 'Unlimited downloads',
        perks: ['FLAC'],
      },
    })
    expect(create.statusCode).toBe(201)
    tierId = create.json().id

    const pub = await app.inject({ method: 'GET', url: '/api/v1/u/fansub-artist/tiers' })
    expect(pub.statusCode).toBe(200)
    expect(pub.json().tiers).toHaveLength(1)
    expect(pub.json().tiers[0].amountCents).toBe(500)
    expect(pub.json().paymentsReady).toBe(true)
  })

  it('rejects an out-of-range tier price', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/fan-tiers',
      headers: { cookie: artistCookie },
      payload: { name: 'Too cheap', amountCents: 50 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('forbids subscribing to yourself', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/u/fansub-artist/subscribe',
      headers: { cookie: artistCookie },
      payload: { tierId },
    })
    expect(res.statusCode).toBe(400)
  })

  it('activates a subscription and records payout + ledger entries', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/u/fansub-artist/subscribe',
      headers: { cookie: fanCookie },
      payload: { tierId },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().activated).toBe(true)

    const payouts = await prisma.fanSubPayout.findMany({ where: { artistUserId: artist.id } })
    expect(payouts).toHaveLength(1)
    // €5.00 → artist €4.45, org €0.10, stripe €0.45
    expect(payouts[0].grossCents).toBe(500)
    expect(payouts[0].netToArtistCents).toBe(445)
    expect(payouts[0].orgFeeCents).toBe(10)

    const ledger = await prisma.ledgerEntry.findMany({
      where: { externalRef: { contains: 'fansub:' } },
    })
    const cats = ledger.map((l) => l.category).sort()
    expect(cats).toEqual(
      ['FAN_SUB_GROSS_RECEIVED', 'FAN_SUB_NET_TO_ARTIST', 'FAN_SUB_OPERATIONAL_FEE'].sort(),
    )
  })

  it('prevents a duplicate active subscription', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/u/fansub-artist/subscribe',
      headers: { cookie: fanCookie },
      payload: { tierId },
    })
    expect(res.statusCode).toBe(409)
  })

  it('lists the subscription for the fan', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/subscriptions',
      headers: { cookie: fanCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    expect(res.json()[0].artist.username).toBe('fansub-artist')
  })

  it('M18: an active fan-subscriber download is weighted 5×', async () => {
    const item = await prisma.archiveItem.create({
      data: {
        channelId: artist.channel!.id,
        title: 'Mix',
        rawKey: 'raw/x.wav',
        mp3Key: 'mp3/x.mp3',
        fileSizeBytes: BigInt(6_000_000),
        status: 'READY',
      },
    })
    const day = new Date().toISOString().slice(0, 10)
    const salt = createHash('sha256').update(`${config.internalSecret}:${day}`).digest('hex')
    const byIpHash = createHash('sha256').update(`127.0.0.1:${salt}`).digest('hex')
    const seenAt = new Date(Date.now() - 25 * 60 * 60 * 1000)
    await prisma.download.create({
      data: {
        channelId: artist.channel!.id,
        archiveItemId: item.id,
        format: 'mp3_320',
        byFingerprint: 'fansub-ip-seed',
        byIpHash,
        countedAt: null,
        reason: 'new_ip',
        weight: 1,
        bytes: 0,
        createdAt: seenAt,
      },
    })
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/c/fansub-artist/archive/${item.id}/download?fp=fan-fp`,
      headers: { cookie: fanCookie },
    })
    expect(res.statusCode).toBe(200)
    const dl = await prisma.download.findFirst({
      where: { channelId: artist.channel!.id, byUserId: fan.id },
    })
    expect(dl?.weight).toBe(5)
    expect(dl?.countedAt).not.toBeNull()
  })

  it('M9: fan-sub euros + paid downloads feed engagement units', async () => {
    // The €5 gross above = 5 units; the 5× download above = 5 units → ≥10.
    await prisma.monthlyRollup.create({
      data: {
        yearMonth: `${YEAR}-01`,
        byCategory: {},
        surplus: BigInt(100_000),
        finalizedAt: new Date(),
      },
    })
    // Re-date this artist's fan-sub payout + download into YEAR so they count.
    const when = new Date(Date.UTC(YEAR, 5, 1))
    await prisma.fanSubPayout.updateMany({
      where: { artistUserId: artist.id },
      data: { forPeriodStart: when, forPeriodEnd: when },
    })
    await prisma.download.updateMany({
      where: { channelId: artist.channel!.id, countedAt: { not: null } },
      data: { countedAt: when },
    })

    const summary = await runAnnualGrantCalc(prisma, YEAR)
    expect(summary.grantCount).toBe(1)
    // 5 (fan-sub euros) + 5 (one 5×-weighted download) = 10 units, sole artist
    expect(summary.totalUnits).toBe(10)

    const grant = await prisma.grantDisbursement.findFirst({ where: { forYear: YEAR } })
    expect(grant?.userId).toBe(artist.id)
    expect(Number(grant?.amountCents)).toBe(90_000) // whole pool to the only artist
  })

  it('cancels a subscription but keeps perks until period end', async () => {
    const sub = await prisma.fanSubscription.findFirst({ where: { subscriberUserId: fan.id } })
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/subscriptions/${sub!.id}/cancel`,
      headers: { cookie: fanCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().state).toBe('CANCELED')
    expect(res.json().accessUntil).toBeTruthy()
    const { isActiveFanSubscriber } = await import('../../lib/fansub.js')
    expect(await isActiveFanSubscriber(prisma, artist.id, fan.id)).toBe(true)
  })

  it('webhook: subscription.created then invoice.paid activates + pays out', async () => {
    const fan2 = await makeUser({
      email: `${PREFIX}fan2@example.com`,
      username: 'fansub-fan2',
      displayName: 'Second Fan',
    })
    const stripeSubId = `sub_test_${fan2.id}`

    const created = await app.inject({
      method: 'POST',
      url: '/api/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        type: 'customer.subscription.created',
        data: {
          object: {
            id: stripeSubId,
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
            metadata: {
              artistUserId: artist.id,
              subscriberUserId: fan2.id,
              tierName: 'Backer',
              amountCents: '1000',
            },
          },
        },
      }),
    })
    expect(created.statusCode).toBe(200)

    const sub = await prisma.fanSubscription.findUnique({
      where: { stripeSubscriptionId: stripeSubId },
    })
    expect(sub?.state).toBe('ACTIVE')

    const paid = await app.inject({
      method: 'POST',
      url: '/api/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        type: 'invoice.paid',
        data: {
          object: {
            subscription: stripeSubId,
            amount_paid: 1000,
            period_start: Math.floor(Date.now() / 1000),
            period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
          },
        },
      }),
    })
    expect(paid.statusCode).toBe(200)

    const payout = await prisma.fanSubPayout.findFirst({ where: { fanSubscriptionId: sub!.id } })
    expect(payout?.grossCents).toBe(1000)
    expect(payout?.netToArtistCents).toBe(921) // €10 → artist €9.21
  })

  it('fan chat access requires FAN_CHAT perk and active subscription', async () => {
    await prisma.fanTier.updateMany({
      where: { artistUserId: artist.id },
      data: { perks: ['FLAC', 'FAN_CHAT'] },
    })

    const access = await app.inject({
      method: 'GET',
      url: '/api/chat/fansub-artist/access',
      headers: { cookie: fanCookie },
    })
    expect(access.statusCode).toBe(200)
    expect(access.json().fanChatEnabled).toBe(true)
    expect(access.json().isSupporter).toBe(true)
    expect(access.json().canJoinFanChat).toBe(true)

    const token = await app.inject({
      method: 'POST',
      url: '/api/chat/fansub-artist/fan-token',
      headers: { cookie: fanCookie },
    })
    expect(token.statusCode).toBe(200)
    expect(token.json().channel).toBe('channel:fansub-artist:fans')
  })
})
