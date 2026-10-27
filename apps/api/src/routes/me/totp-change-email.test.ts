// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import * as OTPAuth from 'otpauth'

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

const PREFIX = 'totp-change-email-'

function codeFor(secretBase32: string): string {
  return new OTPAuth.TOTP({
    issuer: 'Tahti',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  }).generate()
}

describe('Turning two-step sign-in on or off is emailed', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })
    cookie = await sessionCookieFor(prisma, user.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('emails on confirm and on disable', async () => {
    const setup = await app.inject({
      method: 'POST',
      url: '/api/me/totp/setup',
      headers: { cookie },
    })
    const { secret } = setup.json() as { secret: string }
    const confirm = await app.inject({
      method: 'POST',
      url: '/api/me/totp/confirm',
      headers: { cookie },
      payload: { code: codeFor(secret) },
    })
    expect(confirm.statusCode).toBe(200)
    expect(sendSecurityNotice).toHaveBeenLastCalledWith(
      expect.objectContaining({ subject: 'Two-step sign-in is on for your Tahti account' }),
      expect.anything(),
    )

    const disable = await app.inject({
      method: 'POST',
      url: '/api/me/totp/disable',
      headers: { cookie },
      payload: { password: 'testpassword' },
    })
    expect(disable.statusCode).toBe(204)
    expect(sendSecurityNotice).toHaveBeenLastCalledWith(
      expect.objectContaining({ subject: 'Two-step sign-in is off for your Tahti account' }),
      expect.anything(),
    )
  })
})
