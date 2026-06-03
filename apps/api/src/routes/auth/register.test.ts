// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'

const TEST_EMAIL_PREFIX = 'register-test-'

describe('POST /api/auth/register', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    // Clean up any leftovers from previous aborted runs
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })
    app = await buildApp({ logger: false })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  afterEach(async () => {
    // Clean up test users created during this suite
    await prisma.user.deleteMany({
      where: { email: { startsWith: TEST_EMAIL_PREFIX } },
    })
  })

  it('creates a user and returns 201', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `${TEST_EMAIL_PREFIX}1@example.com`,
        password: 'strongpassword123',
        username: 'testartist1',
        displayName: 'Test Artist',
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.userId).toBeDefined()
    expect(body.message).toContain('verify')
  })

  it('creates an associated channel with the same slug as username', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `${TEST_EMAIL_PREFIX}2@example.com`,
        password: 'strongpassword123',
        username: 'testartist2',
        displayName: 'Test Artist',
      },
    })

    const user = await prisma.user.findUnique({
      where: { username: 'testartist2' },
      include: { channel: true, membership: true },
    })

    expect(user).toBeDefined()
    expect(user!.channel).toBeDefined()
    expect(user!.channel!.slug).toBe('testartist2')
    expect(user!.membership).toBeDefined()
    expect(user!.membership!.status).toBe('PENDING_EMAIL')
    expect(user!.emailVerifiedAt).toBeNull()
  })

  it('returns 409 when email is already taken', async () => {
    const payload = {
      email: `${TEST_EMAIL_PREFIX}3@example.com`,
      password: 'strongpassword123',
      username: 'testartist3',
      displayName: 'Test Artist',
    }

    await app.inject({ method: 'POST', url: '/api/auth/register', payload })

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { ...payload, username: 'differentname' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json().error).toContain('email')
  })

  it('returns 409 when username is already taken', async () => {
    const first = {
      email: `${TEST_EMAIL_PREFIX}4a@example.com`,
      password: 'strongpassword123',
      username: 'takenusername',
      displayName: 'First Artist',
    }
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: first })

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `${TEST_EMAIL_PREFIX}4b@example.com`,
        password: 'strongpassword123',
        username: 'takenusername',
        displayName: 'Second Artist',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json().error).toContain('username')
  })

  it('returns 400 for invalid email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'not-an-email',
        password: 'strongpassword123',
        username: 'testuser',
        displayName: 'Test',
      },
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 400 for short password', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `${TEST_EMAIL_PREFIX}5@example.com`,
        password: 'short',
        username: 'testuser5',
        displayName: 'Test',
      },
    })
    expect(response.statusCode).toBe(400)
  })
})
