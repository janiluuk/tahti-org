// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/security-email.js', () => ({
  sendSecurityNotice: vi.fn().mockResolvedValue(undefined),
}))

import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'credential-reset-links-'

describe('Changing the password or email voids outstanding reset links', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })
    userId = user.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const mailResetLink = (token: string) =>
    prisma.passwordSetup.create({
      data: { userId, token, expiresAt: new Date(Date.now() + 3600_000) },
    })

  it('after a password change', async () => {
    await mailResetLink(`${PREFIX}t1`)
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/password',
      headers: { cookie: await sessionCookieFor(prisma, userId) },
      payload: { currentPassword: 'testpassword', newPassword: 'NewPassword123' },
    })
    expect(res.statusCode).toBe(200)
    expect(await prisma.passwordSetup.count({ where: { userId } })).toBe(0)
  })

  it('after an email change', async () => {
    await mailResetLink(`${PREFIX}t2`)
    await prisma.emailChange.create({
      data: {
        userId,
        newEmail: `${PREFIX}new@example.com`,
        token: `${PREFIX}change`,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/email-change/confirm',
      payload: { token: `${PREFIX}change` },
    })
    expect(res.statusCode).toBe(200)
    expect(await prisma.passwordSetup.count({ where: { userId } })).toBe(0)
  })
})
