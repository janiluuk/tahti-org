// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/security-email.js', () => ({
  sendSecurityNotice: vi.fn().mockResolvedValue(undefined),
}))

import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'email-change-newsletter-'

describe('Newsletter subscriptions follow an email change', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let userId: string
  let artistA: string
  let artistB: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}old@example.com`,
      username: `${PREFIX}user`,
    })
    userId = user.id
    artistA = (
      await createTestArtist(prisma, { email: `${PREFIX}a@example.com`, username: `${PREFIX}a` })
    ).id
    artistB = (
      await createTestArtist(prisma, { email: `${PREFIX}b@example.com`, username: `${PREFIX}b` })
    ).id
    await prisma.newsletterSubscriber.createMany({
      data: [
        { artistUserId: artistA, email: `${PREFIX}old@example.com`, unsubToken: `${PREFIX}u1` },
        { artistUserId: artistB, email: `${PREFIX}old@example.com`, unsubToken: `${PREFIX}u2` },
        { artistUserId: artistB, email: `${PREFIX}new@example.com`, unsubToken: `${PREFIX}u3` },
      ],
    })
    await prisma.emailChange.create({
      data: {
        userId,
        newEmail: `${PREFIX}new@example.com`,
        token: `${PREFIX}t`,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('moves them to the new address without duplicating one already there', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/email-change/confirm',
      payload: { token: `${PREFIX}t` },
    })
    expect(res.statusCode).toBe(200)
    expect(
      await prisma.newsletterSubscriber.count({ where: { email: `${PREFIX}old@example.com` } }),
    ).toBe(0)
    const moved = await prisma.newsletterSubscriber.findMany({
      where: { email: `${PREFIX}new@example.com` },
      orderBy: { artistUserId: 'asc' },
    })
    expect(moved.map((s) => s.artistUserId).sort()).toEqual([artistA, artistB].sort())
  })
})
