// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'
import { hashPassword } from '../../lib/password.js'

vi.mock('../../lib/queue.js', () => ({
  mediaQueue: { add: vi.fn().mockResolvedValue(undefined) },
}))

const PREFIX = 'newsletter-me-test-'

describe('M13/M19 — newsletter drafts', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let artistId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'newsletter-me-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98530,
    })
    artistId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await prisma.newsletterDraft.deleteMany({
      where: { user: { email: { startsWith: PREFIX } } },
    })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('creates a draft with subscribersOnly when requested', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/newsletter/drafts',
      headers: { cookie },
      payload: {
        subject: 'Fan-only update',
        bodyMd: 'Thanks for supporting!',
        subscribersOnly: true,
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().subscribersOnly).toBe(true)
    expect(res.json().subject).toBe('Fan-only update')
  })

  it('defaults subscribersOnly to false', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/newsletter/drafts',
      headers: { cookie },
      payload: {
        subject: 'Everyone',
        bodyMd: 'Hello all subscribers',
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().subscribersOnly).toBe(false)
  })

  it('rejects drafts without subject or body', async () => {
    const noSubject = await app.inject({
      method: 'POST',
      url: '/api/me/newsletter/drafts',
      headers: { cookie },
      payload: { bodyMd: 'body only' },
    })
    expect(noSubject.statusCode).toBe(400)

    const noBody = await app.inject({
      method: 'POST',
      url: '/api/me/newsletter/drafts',
      headers: { cookie },
      payload: { subject: 'subject only' },
    })
    expect(noBody.statusCode).toBe(400)
  })

  it('GET /api/me/newsletter/drafts includes subscribersOnly in list', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/me/newsletter/drafts',
      headers: { cookie },
      payload: {
        subject: 'Listed fan draft',
        bodyMd: 'Body',
        subscribersOnly: true,
      },
    })

    const list = await app.inject({
      method: 'GET',
      url: '/api/me/newsletter/drafts',
      headers: { cookie },
    })
    expect(list.statusCode).toBe(200)
    const rows = list.json().drafts as Array<{ subject: string; subscribersOnly: boolean }>
    const fanDraft = rows.find((r) => r.subject === 'Listed fan draft')
    expect(fanDraft?.subscribersOnly).toBe(true)
  })

  it('GET /api/me/newsletter/drafts reports how each send was delivered', async () => {
    const draft = await prisma.newsletterDraft.create({
      data: {
        userId: artistId,
        subject: 'Delivered issue',
        bodyMd: 'Body',
        state: 'SENT',
        sentAt: new Date(),
      },
    })
    const states = ['SENT', 'SENT', 'FAILED', 'BOUNCED', 'QUEUED'] as const
    for (const [i, state] of states.entries()) {
      const subscriber = await prisma.newsletterSubscriber.create({
        data: {
          artistUserId: artistId,
          email: `${PREFIX}delivery-${i}@example.com`,
          unsubToken: `${PREFIX}delivery-${i}-${Date.now()}`,
        },
      })
      await prisma.newsletterSend.create({
        data: { draftId: draft.id, subscriberId: subscriber.id, state },
      })
    }

    const list = await app.inject({
      method: 'GET',
      url: '/api/me/newsletter/drafts',
      headers: { cookie },
    })
    expect(list.statusCode).toBe(200)
    const rows = list.json().drafts as Array<{ id: string; delivery: Record<string, number> }>
    expect(rows.find((r) => r.id === draft.id)?.delivery).toEqual({
      queued: 1,
      sent: 2,
      failed: 1,
      bounced: 1,
    })
    expect(rows.find((r) => r.id !== draft.id)?.delivery).toEqual({
      queued: 0,
      sent: 0,
      failed: 0,
      bounced: 0,
    })
  })

  it('send on subscribersOnly draft targets fans without audience param', async () => {
    const passwordHash = await hashPassword('testpassword')
    const fanUser = await prisma.user.create({
      data: {
        email: `${PREFIX}fan@example.com`,
        passwordHash,
        username: 'newsletter-me-fan',
        displayName: 'Fan',
        emailVerifiedAt: new Date(),
      },
    })

    await prisma.fanTier.create({
      data: {
        artistUserId: artistId,
        name: 'Insider',
        amountCents: 800,
        perks: ['FAN_NEWSLETTER'],
        active: true,
      },
    })
    await prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: fanUser.id,
        tierName: 'Insider',
        amountCents: 800,
        stripeSubscriptionId: 'sub_me_fan_only',
        state: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 3600 * 1000),
      },
    })
    await prisma.newsletterSubscriber.create({
      data: {
        artistUserId: artistId,
        email: `${PREFIX}fan@example.com`,
        confirmedAt: new Date(),
        unsubToken: 'unsub-me-fan',
      },
    })
    await prisma.newsletterSubscriber.create({
      data: {
        artistUserId: artistId,
        email: 'public-me@example.com',
        confirmedAt: new Date(),
        unsubToken: 'unsub-me-public',
      },
    })

    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/me/newsletter/drafts',
      headers: { cookie },
      payload: {
        subject: 'Auto fan send',
        bodyMd: 'For supporters',
        subscribersOnly: true,
      },
    })
    const draftId = draftRes.json().id as string

    const send = await app.inject({
      method: 'POST',
      url: `/api/me/newsletter/send/${draftId}`,
      headers: { cookie },
    })
    expect(send.statusCode).toBe(200)
    expect(send.json().audience).toBe('fans')
    expect(send.json().queued).toBe(1)

    await prisma.user.delete({ where: { id: fanUser.id } })
  })

  it('rejects fan-only send when artist has no FAN_NEWSLETTER perk', async () => {
    const noPerkArtist = await createTestArtist(prisma, {
      email: `${PREFIX}noperk@example.com`,
      username: 'newsletter-me-noperk',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98531,
    })
    const noPerkCookie = await sessionCookieFor(prisma, noPerkArtist.id)

    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/me/newsletter/drafts',
      headers: { cookie: noPerkCookie },
      payload: {
        subject: 'Blocked fan send',
        bodyMd: 'Nope',
        subscribersOnly: true,
      },
    })
    const draftId = draftRes.json().id as string

    await prisma.newsletterSubscriber.create({
      data: {
        artistUserId: noPerkArtist.id,
        email: 'someone@example.com',
        confirmedAt: new Date(),
        unsubToken: 'unsub-noperk',
      },
    })

    const send = await app.inject({
      method: 'POST',
      url: `/api/me/newsletter/send/${draftId}`,
      headers: { cookie: noPerkCookie },
    })
    expect(send.statusCode).toBe(400)
    expect(send.json().error).toMatch(/FAN_NEWSLETTER/i)
  })

  it('records body mentions when the newsletter is sent, not when it is drafted', async () => {
    const sender = await createTestArtist(prisma, {
      email: `${PREFIX}mentioner@example.com`,
      username: 'newsletter-me-mentioner',
      tier: 'STUDIO',
    })
    const target = await createTestArtist(prisma, {
      email: `${PREFIX}mentioned@example.com`,
      username: 'newsletter-me-mentioned',
    })
    const senderCookie = await sessionCookieFor(prisma, sender.id)
    await prisma.newsletterSubscriber.create({
      data: {
        artistUserId: sender.id,
        email: 'mention-reader@example.com',
        confirmedAt: new Date(),
        unsubToken: 'unsub-me-mention',
      },
    })
    const mentionsOf = () =>
      prisma.mention.findMany({
        where: { mentionerUserId: sender.id, targetUserId: target.id },
      })

    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/me/newsletter/drafts',
      headers: { cookie: senderCookie },
      payload: { subject: 'Tour news', bodyMd: 'Touring with @newsletter-me-mentioned' },
    })
    expect(draftRes.statusCode).toBe(201)
    const draftId = draftRes.json().id as string
    expect(await mentionsOf()).toHaveLength(0)

    const send = await app.inject({
      method: 'POST',
      url: `/api/me/newsletter/send/${draftId}`,
      headers: { cookie: senderCookie },
    })
    expect(send.statusCode).toBe(200)

    await vi.waitFor(async () => {
      const rows = await mentionsOf()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ surface: 'NEWSLETTER', sourceId: draftId })
    })
  })
})

describe('newsletter — subscribing with an account email', () => {
  const P = 'newsletter-me-sub-test-'
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, P)
    const artist = await createTestArtist(prisma, {
      email: `${P}artist@example.com`,
      username: `${P}artist`,
    })
    artistId = artist.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, P)
    await app.close()
  })

  it('subscribes a verified account without a confirmation email', async () => {
    const fan = await createTestArtist(prisma, {
      email: `${P}fan@example.com`,
      username: `${P}fan`,
    })
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/newsletter/subscription/${P}artist`,
      headers: { cookie: await sessionCookieFor(prisma, fan.id) },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ subscribed: true })
  })

  it('refuses an account whose email is not verified', async () => {
    const stranger = await createTestArtist(prisma, {
      email: `${P}someone-else@example.com`,
      username: `${P}stranger`,
      emailVerified: false,
    })
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/newsletter/subscription/${P}artist`,
      headers: { cookie: await sessionCookieFor(prisma, stranger.id) },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('email_not_verified')
    expect(
      await prisma.newsletterSubscriber.count({
        where: { artistUserId: artistId, email: `${P}someone-else@example.com` },
      }),
    ).toBe(0)
  })

  it('does not subscribe to a suspended artist', async () => {
    const fan = await prisma.user.findUniqueOrThrow({ where: { email: `${P}fan@example.com` } })
    await prisma.user.update({ where: { id: artistId }, data: { suspendedAt: new Date() } })
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/newsletter/subscription/${P}artist`,
      headers: { cookie: await sessionCookieFor(prisma, fan.id) },
    })
    expect(res.statusCode).toBe(404)
    await prisma.user.update({ where: { id: artistId }, data: { suspendedAt: null } })
  })
})
