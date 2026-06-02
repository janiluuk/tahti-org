// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { generateVerificationToken, verificationExpiresAt } from '../../lib/token.js'

const TEST_EMAIL_PREFIX = 'login-test-'

describe('POST /api/auth/login', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    // Clean up any leftover data from previous runs, then create the test user
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })

    const passwordHash = await hashPassword('correctpassword')
    await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}user@example.com`,
        passwordHash,
        username: 'login-test-user',
        displayName: 'Login Test User',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'ACTIVE', activatedAt: new Date() } },
        channel: {
          create: {
            slug: 'login-test-user',
            liveSourceMount: '/live/login-test-user',
            liveSourcePassHash: 'dummy',
            rtmpStreamKeyHash: 'dummy',
          },
        },
      },
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })
    await app.close()
  })

  afterEach(async () => {
    // Clean up any extra users created in individual tests (e.g. unverified user)
    await prisma.user.deleteMany({
      where: {
        email: { startsWith: TEST_EMAIL_PREFIX },
        username: { not: 'login-test-user' },
      },
    })
  })

  it('returns 200 and sets a session cookie on correct credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: `${TEST_EMAIL_PREFIX}user@example.com`,
        password: 'correctpassword',
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.user.username).toBe('login-test-user')
    expect(response.cookies.some((c) => c.name === 'tahti_session')).toBe(true)
  })

  it('returns 401 for wrong password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: `${TEST_EMAIL_PREFIX}user@example.com`,
        password: 'wrongpassword',
      },
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 401 for non-existent email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@example.com', password: 'somepassword' },
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 403 when email is not verified', async () => {
    // Create unverified user
    const passwordHash = await hashPassword('correctpassword')
    await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}unverified@example.com`,
        passwordHash,
        username: 'login-test-unverified',
        displayName: 'Unverified',
        membership: { create: {} },
        channel: {
          create: {
            slug: 'login-test-unverified',
            liveSourceMount: '/live/login-test-unverified',
            liveSourcePassHash: 'dummy',
            rtmpStreamKeyHash: 'dummy',
          },
        },
      },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: `${TEST_EMAIL_PREFIX}unverified@example.com`,
        password: 'correctpassword',
      },
    })
    expect(response.statusCode).toBe(403)
  })

  it('GET /api/auth/me returns user after login', async () => {
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: `${TEST_EMAIL_PREFIX}user@example.com`,
        password: 'correctpassword',
      },
    })

    const cookie = loginResponse.cookies.find((c) => c.name === 'tahti_session')!
    expect(cookie).toBeDefined()

    const meResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { tahti_session: cookie.value },
    })

    expect(meResponse.statusCode).toBe(200)
    expect(meResponse.json().username).toBe('login-test-user')
  })

  it('GET /api/auth/me returns 401 without session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/me' })
    expect(response.statusCode).toBe(401)
  })

  it('POST /api/auth/logout clears the session', async () => {
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: `${TEST_EMAIL_PREFIX}user@example.com`,
        password: 'correctpassword',
      },
    })

    const cookie = loginResponse.cookies.find((c) => c.name === 'tahti_session')!

    await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { tahti_session: cookie.value },
    })

    const meResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { tahti_session: cookie.value },
    })
    expect(meResponse.statusCode).toBe(401)
  })
})

describe('GET /api/auth/verify', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  afterEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: TEST_EMAIL_PREFIX } },
    })
  })

  it('verifies email and activates membership', async () => {
    const passwordHash = await hashPassword('pass')
    const user = await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}verify@example.com`,
        passwordHash,
        username: 'login-test-verify',
        displayName: 'Verify Test',
        membership: { create: {} },
        channel: {
          create: {
            slug: 'login-test-verify',
            liveSourceMount: '/live/login-test-verify',
            liveSourcePassHash: 'dummy',
            rtmpStreamKeyHash: 'dummy',
          },
        },
      },
    })

    const token = generateVerificationToken()
    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token,
        expiresAt: verificationExpiresAt(),
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: `/api/auth/verify?token=${token}`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().message).toContain('verified')

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      include: { membership: true },
    })
    expect(updated!.emailVerifiedAt).toBeDefined()
    expect(updated!.membership!.status).toBe('ACTIVE')
  })

  it('returns 400 for an expired token', async () => {
    const passwordHash = await hashPassword('pass')
    const user = await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}expired@example.com`,
        passwordHash,
        username: 'login-test-expired',
        displayName: 'Expired Test',
        membership: { create: {} },
        channel: {
          create: {
            slug: 'login-test-expired',
            liveSourceMount: '/live/login-test-expired',
            liveSourcePassHash: 'dummy',
            rtmpStreamKeyHash: 'dummy',
          },
        },
      },
    })

    const token = generateVerificationToken()
    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() - 1000), // already expired
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: `/api/auth/verify?token=${token}`,
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().error).toContain('expired')
  })

  it('returns 400 for unknown token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/verify?token=unknowntoken12345678901234567890',
    })
    expect(response.statusCode).toBe(400)
    expect(response.json().error).toContain('Invalid')
  })
})
