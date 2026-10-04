// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { sendMail } from '../../lib/email.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

vi.mock('../../lib/email.js', () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/queue.js', () => ({
  mediaQueue: { add: vi.fn().mockResolvedValue(undefined) },
}))

const PREFIX = 'newsletter-test-'

describe('M13 — newsletter', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistCookie: string
  let username: string
  let artistId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    username = 'newsletter-artist'
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98360,
    })
    artistId = artist.id
    artistCookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('POST /api/newsletter/subscribe validates email and artist', async () => {
    const bad = await app.inject({
      method: 'POST',
      url: '/api/newsletter/subscribe',
      payload: { email: 'not-an-email', artistUsername: username },
    })
    expect(bad.statusCode).toBe(400)

    const missing = await app.inject({
      method: 'POST',
      url: '/api/newsletter/subscribe',
      payload: { email: 'fan@example.com' },
    })
    expect(missing.statusCode).toBe(400)

    const ok = await app.inject({
      method: 'POST',
      url: '/api/newsletter/subscribe',
      payload: { email: 'fan@example.com', artistUsername: username },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().status).toBe('confirmation_sent')

    const sub = await prisma.newsletterSubscriber.findUnique({
      where: { artistUserId_email: { artistUserId: artistId, email: 'fan@example.com' } },
    })
    expect(sub?.confirmToken).toBeTruthy()
  })

  it('confirm and unsubscribe tokens update subscriber state', async () => {
    const sub = await prisma.newsletterSubscriber.findUnique({
      where: { artistUserId_email: { artistUserId: artistId, email: 'fan@example.com' } },
    })
    const confirm = await app.inject({
      method: 'GET',
      url: `/api/newsletter/confirm/${sub!.confirmToken}`,
    })
    expect(confirm.statusCode).toBe(302)

    const confirmed = await prisma.newsletterSubscriber.findUnique({ where: { id: sub!.id } })
    expect(confirmed?.confirmedAt).not.toBeNull()

    const unsub = await app.inject({
      method: 'GET',
      url: `/api/newsletter/unsubscribe/${confirmed!.unsubToken}`,
    })
    expect(unsub.statusCode).toBe(302)
    const after = await prisma.newsletterSubscriber.findUnique({ where: { id: sub!.id } })
    expect(after?.unsubscribedAt).not.toBeNull()
  })

  it('unsubscribes on a one-click POST from a mail provider', async () => {
    const sub = await prisma.newsletterSubscriber.create({
      data: {
        artistUserId: artistId,
        email: 'one-click@example.com',
        confirmedAt: new Date(),
        unsubToken: `one-click-token-${Date.now()}`,
      },
    })
    const post = () =>
      app.inject({
        method: 'POST',
        url: `/api/newsletter/unsubscribe/${sub.unsubToken}`,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'List-Unsubscribe=One-Click',
      })
    const first = await post()
    expect(first.statusCode).toBe(200)
    const after = await prisma.newsletterSubscriber.findUnique({ where: { id: sub.id } })
    expect(after?.unsubscribedAt).not.toBeNull()
    expect((await post()).statusCode).toBe(200)

    const unknown = await app.inject({
      method: 'POST',
      url: '/api/newsletter/unsubscribe/not-a-real-token',
    })
    expect(unknown.statusCode).toBe(404)
    await prisma.newsletterSubscriber.delete({ where: { id: sub.id } })
  })

  it('asks an unsubscribed address to confirm again before it is back on the list', async () => {
    const where = { artistUserId_email: { artistUserId: artistId, email: 'fan@example.com' } }
    const before = await prisma.newsletterSubscriber.findUnique({ where })
    expect(before?.confirmedAt).not.toBeNull()
    expect(before?.unsubscribedAt).not.toBeNull()

    const again = await app.inject({
      method: 'POST',
      url: '/api/newsletter/subscribe',
      payload: { email: 'fan@example.com', artistUsername: username },
    })
    expect(again.json().status).toBe('confirmation_sent')
    const pending = await prisma.newsletterSubscriber.findUnique({ where })
    expect(pending?.confirmedAt).toBeNull()
    expect(
      await prisma.newsletterSubscriber.count({
        where: { artistUserId: artistId, confirmedAt: { not: null }, unsubscribedAt: null },
      }),
    ).toBe(0)

    const confirm = await app.inject({
      method: 'GET',
      url: `/api/newsletter/confirm/${pending!.confirmToken}`,
    })
    expect(confirm.statusCode).toBe(302)
    const confirmed = await prisma.newsletterSubscriber.findUnique({ where })
    expect(confirmed?.confirmedAt).not.toBeNull()
    expect(confirmed?.unsubscribedAt).toBeNull()
  })

  it('does not take subscriptions for a suspended or deleted artist', async () => {
    for (const data of [{ suspendedAt: new Date() }, { deletedAt: new Date() }]) {
      await prisma.user.update({ where: { id: artistId }, data })
      const res = await app.inject({
        method: 'POST',
        url: '/api/newsletter/subscribe',
        payload: { email: 'late-fan@example.com', artistUsername: username },
      })
      expect(res.statusCode).toBe(404)
      await prisma.user.update({
        where: { id: artistId },
        data: { suspendedAt: null, deletedAt: null },
      })
    }
  })

  it('artist can create a draft and queue send to confirmed subscribers', async () => {
    await prisma.newsletterSubscriber.updateMany({
      where: { artistUserId: artistId, email: 'fan@example.com' },
      data: { confirmedAt: new Date(), unsubscribedAt: null, confirmToken: null },
    })

    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/me/newsletter/drafts',
      headers: { cookie: artistCookie },
      payload: { subject: 'Hello fans', bodyMd: 'New mix is up @newsletter-artist' },
    })
    expect(draftRes.statusCode).toBe(201)
    const draftId = draftRes.json().id

    const stats = await app.inject({
      method: 'GET',
      url: '/api/me/newsletter/subscribers',
      headers: { cookie: artistCookie },
    })
    expect(stats.json().confirmed).toBeGreaterThanOrEqual(1)

    const send = await app.inject({
      method: 'POST',
      url: `/api/me/newsletter/send/${draftId}`,
      headers: { cookie: artistCookie },
    })
    expect(send.statusCode).toBe(200)
    expect(send.json().queued).toBeGreaterThanOrEqual(1)

    const draft = await prisma.newsletterDraft.findUnique({ where: { id: draftId } })
    expect(draft?.state).toBe('QUEUED')
  })

  it('enforces weekly send limit for FREE tier artists', async () => {
    const freeArtist = await createTestArtist(prisma, {
      email: `${PREFIX}free@example.com`,
      username: 'newsletter-free',
      tier: 'FREE',
    })
    const cookie = await sessionCookieFor(prisma, freeArtist.id)

    await prisma.newsletterDraft.create({
      data: {
        userId: freeArtist.id,
        subject: 'Sent',
        bodyMd: 'body',
        state: 'SENT',
        sentAt: new Date(),
      },
    })

    const draft = await prisma.newsletterDraft.create({
      data: {
        userId: freeArtist.id,
        subject: 'Second',
        bodyMd: 'body',
        state: 'DRAFT',
      },
    })

    await prisma.newsletterSubscriber.create({
      data: {
        artistUserId: freeArtist.id,
        email: 'sub@example.com',
        confirmedAt: new Date(),
        unsubToken: 'unsub-free',
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/newsletter/send/${draft.id}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(429)
  })

  it('queues fan-only sends when audience=fans and tier has FAN_NEWSLETTER', async () => {
    const { hashPassword } = await import('../../lib/password.js')
    const passwordHash = await hashPassword('testpassword')
    const fanUser = await prisma.user.create({
      data: {
        email: `${PREFIX}fansub@example.com`,
        passwordHash,
        username: 'newsletter-fan-user',
        displayName: 'Fan User',
        emailVerifiedAt: new Date(),
      },
    })

    await prisma.fanTier.create({
      data: {
        artistUserId: artistId,
        name: 'Patron',
        amountCents: 1000,
        perks: ['FAN_NEWSLETTER'],
        active: true,
      },
    })
    await prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: fanUser.id,
        tierName: 'Patron',
        amountCents: 1000,
        stripeSubscriptionId: 'sub_nl_fan',
        state: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      },
    })
    await prisma.newsletterSubscriber.create({
      data: {
        artistUserId: artistId,
        email: `${PREFIX}fansub@example.com`,
        confirmedAt: new Date(),
        unsubToken: 'unsub-fan-only',
      },
    })
    await prisma.newsletterSubscriber.create({
      data: {
        artistUserId: artistId,
        email: 'public-only@example.com',
        confirmedAt: new Date(),
        unsubToken: 'unsub-public-only',
      },
    })

    const draftRes = await app.inject({
      method: 'POST',
      url: '/api/me/newsletter/drafts',
      headers: { cookie: artistCookie },
      payload: { subject: 'Fans only', bodyMd: 'Secret update' },
    })
    const draftId = draftRes.json().id

    const send = await app.inject({
      method: 'POST',
      url: `/api/me/newsletter/send/${draftId}`,
      headers: { cookie: artistCookie },
      payload: { audience: 'fans' },
    })
    expect(send.statusCode).toBe(200)
    expect(send.json().audience).toBe('fans')
    expect(send.json().queued).toBe(1)

    await prisma.user.delete({ where: { id: fanUser.id } })
  })

  it('never puts an email address in the confirmation subject', async () => {
    await prisma.user.update({ where: { id: artistId }, data: { displayName: 'me@example.com' } })
    vi.mocked(sendMail).mockClear()

    const res = await app.inject({
      method: 'POST',
      url: '/api/newsletter/subscribe',
      payload: { email: 'subject-fan@example.com', artistUsername: username },
    })
    expect(res.statusCode).toBe(200)
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: `Confirm your subscription to ${username}` }),
    )
  })
})
