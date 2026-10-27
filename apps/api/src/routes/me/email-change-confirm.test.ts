// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/security-email.js', () => ({
  sendSecurityNotice: vi.fn().mockResolvedValue(undefined),
}))

import { sendSecurityNotice } from '../../lib/security-email.js'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'email-change-confirm-'

describe('POST /api/auth/email-change/confirm', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}old@example.com`,
      username: `${PREFIX}user`,
    })
    userId = user.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const confirm = (token: string) =>
    app.inject({ method: 'POST', url: '/api/auth/email-change/confirm', payload: { token } })

  it('refuses an expired link', async () => {
    await prisma.emailChange.create({
      data: {
        userId,
        newEmail: `${PREFIX}late@example.com`,
        token: `${PREFIX}expired`,
        expiresAt: new Date(Date.now() - 1000),
      },
    })
    expect((await confirm(`${PREFIX}expired`)).statusCode).toBe(400)
  })

  it('moves the account, tells the old address, and works once', async () => {
    await prisma.emailChange.create({
      data: {
        userId,
        newEmail: `${PREFIX}new@example.com`,
        token: `${PREFIX}good`,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    })
    const res = await confirm(`${PREFIX}good`)
    expect(res.statusCode).toBe(200)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user.email).toBe(`${PREFIX}new@example.com`)
    expect(user.emailVerifiedAt).not.toBeNull()
    expect(sendSecurityNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        to: `${PREFIX}old@example.com`,
        subject: 'Your Tahti email address was changed',
      }),
      expect.anything(),
    )
    expect((await confirm(`${PREFIX}good`)).statusCode).toBe(400)

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${PREFIX}new@example.com`, password: 'testpassword' },
    })
    expect(login.statusCode).toBe(200)
  })
})
