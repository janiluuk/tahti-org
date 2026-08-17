// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'resend-verification-'

describe('POST /api/auth/resend-verification', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('creates a fresh verification token for an unverified account', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}unverified@example.com`,
      username: `${PREFIX}unverified`,
      emailVerified: false,
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/resend-verification',
      payload: { email: `${PREFIX}unverified@example.com` },
    })
    expect(res.statusCode).toBe(200)

    const verification = await prisma.emailVerification.findFirst({
      where: { userId: artist.id },
      orderBy: { createdAt: 'desc' },
    })
    expect(verification).toBeTruthy()
    expect(verification?.usedAt).toBeNull()

    const verify = await app.inject({
      method: 'GET',
      url: `/api/auth/verify?token=${verification!.token}`,
    })
    expect(verify.statusCode).toBe(200)
  })

  it('returns the same generic response for an unknown email (no enumeration)', async () => {
    const known = await app.inject({
      method: 'POST',
      url: '/api/auth/resend-verification',
      payload: { email: `${PREFIX}totally-unknown@example.com` },
    })
    expect(known.statusCode).toBe(200)
    expect(known.json()).toHaveProperty('message')
  })

  it('does not create a new token for an already-verified account', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}verified@example.com`,
      username: `${PREFIX}verified`,
      emailVerified: true,
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/resend-verification',
      payload: { email: `${PREFIX}verified@example.com` },
    })
    expect(res.statusCode).toBe(200)

    const count = await prisma.emailVerification.count({ where: { userId: artist.id } })
    expect(count).toBe(0)
  })
})
