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

const PREFIX = 'new-device-signin-'

describe('Signing in from a new device is emailed', () => {
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
    await prisma.auditLog.deleteMany({ where: { actorId: userId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const login = async (deviceLabel: string) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${PREFIX}user@example.com`, password: 'testpassword', deviceLabel },
    })
    expect(res.statusCode).toBe(200)
    await vi.waitFor(async () =>
      expect(
        await prisma.auditLog.count({
          where: {
            action: 'USER_LOGIN',
            actorId: userId,
            meta: { path: ['deviceLabel'], equals: deviceLabel },
          },
        }),
      ).toBeGreaterThan(0),
    )
  }

  it('stays quiet for the first sign-in and a known device, emails for a new one', async () => {
    await login('Firefox on Linux')
    await login('Firefox on Linux')
    expect(sendSecurityNotice).not.toHaveBeenCalled()

    await login('Safari on iPhone')
    expect(sendSecurityNotice).toHaveBeenCalledTimes(1)
    expect(sendSecurityNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'New sign-in to your Tahti account',
        what: expect.stringContaining('Safari on iPhone'),
      }),
      expect.anything(),
    )
  })
})
