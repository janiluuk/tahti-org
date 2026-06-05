// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'email-bounce-test-'
const WEBHOOK_SECRET = 'test-bounce-secret'

describe('M13 — email bounce webhook', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistId: string
  let subscriberId: string
  let sendId: string

  beforeAll(async () => {
    vi.stubEnv('EMAIL_BOUNCE_WEBHOOK_SECRET', WEBHOOK_SECRET)
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'bounce-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98361,
    })
    artistId = artist.id

    const sub = await prisma.newsletterSubscriber.create({
      data: {
        artistUserId: artistId,
        email: `${PREFIX}fan@example.com`,
        confirmedAt: new Date(),
        unsubToken: 'unsub-bounce-test',
      },
    })
    subscriberId = sub.id

    const draft = await prisma.newsletterDraft.create({
      data: {
        userId: artistId,
        subject: 'Bounce test',
        bodyMd: 'hello',
        state: 'SENT',
        sentAt: new Date(),
      },
    })

    const send = await prisma.newsletterSend.create({
      data: {
        draftId: draft.id,
        subscriberId: sub.id,
        state: 'SENT',
        sentAt: new Date(),
      },
    })
    sendId = send.id
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('rejects requests with wrong webhook secret', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/email/bounce',
      headers: { 'x-tahti-webhook-secret': 'wrong-secret' },
      payload: { email: `${PREFIX}fan@example.com`, type: 'hard' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('hard bounce unsubscribes and marks send bounced', async () => {
    await prisma.newsletterSubscriber.update({
      where: { id: subscriberId },
      data: { unsubscribedAt: null },
    })
    await prisma.newsletterSend.update({
      where: { id: sendId },
      data: { state: 'SENT', bouncedAt: null },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/email/bounce',
      headers: { 'x-tahti-webhook-secret': WEBHOOK_SECRET },
      payload: {
        RecordType: 'Bounce',
        Type: 'HardBounce',
        Email: `${PREFIX}fan@example.com`,
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().unsubscribed).toBe(1)
    expect(res.json().sendsMarked).toBe(1)

    const sub = await prisma.newsletterSubscriber.findUnique({ where: { id: subscriberId } })
    expect(sub?.unsubscribedAt).not.toBeNull()

    const send = await prisma.newsletterSend.findUnique({ where: { id: sendId } })
    expect(send?.state).toBe('BOUNCED')
    expect(send?.bouncedAt).not.toBeNull()
  })

  it('soft bounce is acknowledged without unsubscribe', async () => {
    await prisma.newsletterSubscriber.update({
      where: { id: subscriberId },
      data: { unsubscribedAt: null },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/email/bounce',
      headers: { 'x-tahti-webhook-secret': WEBHOOK_SECRET },
      payload: {
        RecordType: 'Bounce',
        Type: 'SoftBounce',
        Email: `${PREFIX}fan@example.com`,
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().action).toBe('ignored')

    const sub = await prisma.newsletterSubscriber.findUnique({ where: { id: subscriberId } })
    expect(sub?.unsubscribedAt).toBeNull()
  })
})
