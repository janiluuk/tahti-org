// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'

const TEST_EMAIL_PREFIX = 'username-available-test-'
const TAKEN_USERNAME = 'usernameavailtaken'

describe('GET /api/auth/username-available', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })
    app = await buildApp({ logger: false })
    await app.ready()

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `${TEST_EMAIL_PREFIX}1@example.com`,
        password: 'strongpassword123',
        username: TAKEN_USERNAME,
        displayName: 'Taken Artist',
      },
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })
    await app.close()
  })

  afterEach(async () => {
    await prisma.user.deleteMany({
      where: { username: { in: [`${TAKEN_USERNAME}-live`, `${TAKEN_USERNAME}-music`] } },
    })
  })

  it('returns available: true for an unused handle', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/username-available?username=brand-new-handle',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ available: true })
  })

  it('returns available: false with suggestions for a taken handle', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/auth/username-available?username=${TAKEN_USERNAME}`,
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.available).toBe(false)
    expect(body.suggestions).toEqual([`${TAKEN_USERNAME}-live`, `${TAKEN_USERNAME}-music`])
  })

  it('omits a suggestion that is itself taken', async () => {
    await prisma.user.create({
      data: {
        email: `${TEST_EMAIL_PREFIX}2@example.com`,
        passwordHash: 'x',
        username: `${TAKEN_USERNAME}-live`,
        displayName: 'Suggestion Holder',
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: `/api/auth/username-available?username=${TAKEN_USERNAME}`,
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.available).toBe(false)
    expect(body.suggestions).toEqual([`${TAKEN_USERNAME}-music`])
  })

  it('returns 400 for an invalid handle', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/username-available?username=AB',
    })

    expect(response.statusCode).toBe(400)
  })
})
