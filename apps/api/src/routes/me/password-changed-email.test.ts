// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/security-email.js', () => ({
  sendSecurityNotice: vi.fn().mockResolvedValue(undefined),
}))

import { sendSecurityNotice } from '../../lib/security-email.js'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'password-changed-email-'

describe('A password change is emailed to the account', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
      displayName: 'Aino',
    })
    userId = user.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('after a change in Settings', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/password',
      headers: { cookie: await sessionCookieFor(prisma, userId) },
      payload: { currentPassword: 'testpassword', newPassword: 'NewPassword123' },
    })
    expect(res.statusCode).toBe(200)
    expect(sendSecurityNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        to: `${PREFIX}user@example.com`,
        displayName: 'Aino',
        subject: 'Your Tahti password was changed',
      }),
      expect.anything(),
    )
  })

  it('after a reset from an emailed link', async () => {
    const token = `${PREFIX}reset-token`
    await prisma.passwordSetup.create({
      data: { userId, token, expiresAt: new Date(Date.now() + 3600_000) },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token, password: 'OtherPassword456' },
    })
    expect(res.statusCode).toBe(200)
    expect(sendSecurityNotice).toHaveBeenLastCalledWith(
      expect.objectContaining({ subject: 'Your Tahti password was reset' }),
      expect.anything(),
    )
  })
})
