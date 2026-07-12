// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as OTPAuth from 'otpauth'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  createTestArtist,
  sessionCookieFor,
  cleanupUsersByEmailPrefix,
} from '../../test/helpers.js'

const TEST_EMAIL_PREFIX = 'totp-test-'

function codeFor(secretBase32: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: 'Tahti',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  })
  return totp.generate()
}

describe('2FA (TOTP) login flow', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let userId: string
  let sessionCookie: string
  let totpSecret: string
  let backupCodes: string[]

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    await cleanupUsersByEmailPrefix(prisma, TEST_EMAIL_PREFIX)

    const user = await createTestArtist(prisma, {
      email: `${TEST_EMAIL_PREFIX}user@example.com`,
      username: 'totp-test-user',
      emailVerified: true,
    })
    userId = user.id
    sessionCookie = await sessionCookieFor(prisma, userId)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, TEST_EMAIL_PREFIX)
    await app.close()
  })

  it('user registers → sets up 2FA → confirms with an authenticator code', async () => {
    const setupResponse = await app.inject({
      method: 'POST',
      url: '/api/me/totp/setup',
      headers: { cookie: sessionCookie },
    })
    expect(setupResponse.statusCode).toBe(200)
    const setupBody = setupResponse.json() as { secret: string; otpauthUri: string }
    expect(setupBody.secret).toBeTruthy()
    expect(setupBody.otpauthUri).toContain('otpauth://totp/')
    totpSecret = setupBody.secret

    // 2FA isn't enabled until the pending secret is confirmed with a real code.
    const statusBeforeConfirm = await app.inject({
      method: 'GET',
      url: '/api/me/totp/status',
      headers: { cookie: sessionCookie },
    })
    expect(statusBeforeConfirm.json().enabled).toBe(false)

    const confirmResponse = await app.inject({
      method: 'POST',
      url: '/api/me/totp/confirm',
      headers: { cookie: sessionCookie },
      payload: { code: codeFor(totpSecret) },
    })
    expect(confirmResponse.statusCode).toBe(200)
    backupCodes = (confirmResponse.json() as { backupCodes: string[] }).backupCodes
    expect(backupCodes).toHaveLength(8)

    const statusAfterConfirm = await app.inject({
      method: 'GET',
      url: '/api/me/totp/status',
      headers: { cookie: sessionCookie },
    })
    expect(statusAfterConfirm.json().enabled).toBe(true)
  })

  it('rejects an invalid confirm code', async () => {
    // Independent setup so this test doesn't disturb the shared secret used elsewhere.
    const setupResponse = await app.inject({
      method: 'POST',
      url: '/api/me/totp/setup',
      headers: { cookie: sessionCookie },
    })
    const { secret } = setupResponse.json() as { secret: string }
    const wrongCode = codeFor(secret) === '000000' ? '111111' : '000000'

    const confirmResponse = await app.inject({
      method: 'POST',
      url: '/api/me/totp/confirm',
      headers: { cookie: sessionCookie },
      payload: { code: wrongCode },
    })
    expect(confirmResponse.statusCode).toBe(400)

    // Re-confirm with the real code so 2FA is back on for the login tests below.
    // Confirming always rotates backup codes, so recapture the fresh set too.
    const reconfirm = await app.inject({
      method: 'POST',
      url: '/api/me/totp/confirm',
      headers: { cookie: sessionCookie },
      payload: { code: codeFor(secret) },
    })
    totpSecret = secret
    backupCodes = (reconfirm.json() as { backupCodes: string[] }).backupCodes
  })

  it('login with a 2FA-enabled account returns a challenge, not a session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${TEST_EMAIL_PREFIX}user@example.com`, password: 'testpassword' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json() as { requiresTotp?: boolean; challengeId?: string; user?: unknown }
    expect(body.requiresTotp).toBe(true)
    expect(body.challengeId).toBeTruthy()
    expect(body.user).toBeUndefined()
    expect(response.cookies.some((c) => c.name === 'tahti_session')).toBe(false)
  })

  it('completes login with a valid authenticator code', async () => {
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${TEST_EMAIL_PREFIX}user@example.com`, password: 'testpassword' },
    })
    const { challengeId } = loginResponse.json() as { challengeId: string }

    const totpResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login/totp',
      payload: { challengeId, code: codeFor(totpSecret) },
    })

    expect(totpResponse.statusCode).toBe(200)
    expect(totpResponse.json().user.username).toBe('totp-test-user')
    const cookie = totpResponse.cookies.find((c) => c.name === 'tahti_session')
    expect(cookie).toBeDefined()

    const meResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { tahti_session: cookie!.value },
    })
    expect(meResponse.statusCode).toBe(200)
    expect(meResponse.json().username).toBe('totp-test-user')
  })

  it('rejects an incorrect authenticator code', async () => {
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${TEST_EMAIL_PREFIX}user@example.com`, password: 'testpassword' },
    })
    const { challengeId } = loginResponse.json() as { challengeId: string }
    const wrongCode = codeFor(totpSecret) === '000000' ? '111111' : '000000'

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login/totp',
      payload: { challengeId, code: wrongCode },
    })
    expect(response.statusCode).toBe(401)
  })

  it('accepts a backup code once, then rejects it on reuse', async () => {
    const backupCode = backupCodes[0]!

    const loginResponse1 = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${TEST_EMAIL_PREFIX}user@example.com`, password: 'testpassword' },
    })
    const { challengeId: challengeId1 } = loginResponse1.json() as { challengeId: string }

    const firstUse = await app.inject({
      method: 'POST',
      url: '/api/auth/login/totp',
      payload: { challengeId: challengeId1, code: backupCode },
    })
    expect(firstUse.statusCode).toBe(200)
    expect(firstUse.cookies.some((c) => c.name === 'tahti_session')).toBe(true)

    const loginResponse2 = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${TEST_EMAIL_PREFIX}user@example.com`, password: 'testpassword' },
    })
    const { challengeId: challengeId2 } = loginResponse2.json() as { challengeId: string }

    const secondUse = await app.inject({
      method: 'POST',
      url: '/api/auth/login/totp',
      payload: { challengeId: challengeId2, code: backupCode },
    })
    expect(secondUse.statusCode).toBe(401)
  })

  it('rejects an expired login challenge', async () => {
    const expiredChallenge = await prisma.totpChallenge.create({
      data: {
        id: 'expired-challenge-totp-test',
        userId,
        expiresAt: new Date(Date.now() - 1000),
      },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login/totp',
      payload: { challengeId: expiredChallenge.id, code: codeFor(totpSecret) },
    })
    expect(response.statusCode).toBe(401)
  })

  it('disabling 2FA requires the account password', async () => {
    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/api/me/totp/disable',
      headers: { cookie: sessionCookie },
      payload: { password: 'not-the-real-password' },
    })
    expect(wrongPassword.statusCode).toBe(401)

    const correctPassword = await app.inject({
      method: 'POST',
      url: '/api/me/totp/disable',
      headers: { cookie: sessionCookie },
      payload: { password: 'testpassword' },
    })
    expect(correctPassword.statusCode).toBe(204)

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${TEST_EMAIL_PREFIX}user@example.com`, password: 'testpassword' },
    })
    expect(loginResponse.statusCode).toBe(200)
    expect(loginResponse.json().requiresTotp).toBeUndefined()
    expect(loginResponse.cookies.some((c) => c.name === 'tahti_session')).toBe(true)
  })
})
