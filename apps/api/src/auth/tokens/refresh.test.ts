// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { config } from '../../config.js'

const PREFIX = 'refresh-token-test-'

describe('auth refresh tokens', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const email = `${PREFIX}user@example.com`
  const password = 'correctpassword'

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    const passwordHash = await hashPassword(password)
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        username: 'refresh-token-user',
        displayName: 'Refresh Token User',
        emailVerifiedAt: new Date(),
      },
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
  })

  beforeEach(async () => {
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } })
      await prisma.session.deleteMany({ where: { userId: user.id } })
    }
  })

  async function login() {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password, deviceLabel: 'Test Device' },
    })
    expect(response.statusCode).toBe(200)
    return response
  }

  it('login returns access + refresh and does not revoke other sessions', async () => {
    const first = await login()
    const second = await login()
    expect(first.json().accessToken).toBeTruthy()
    expect(second.json().refreshToken).toBeTruthy()
    const user = await prisma.user.findUniqueOrThrow({ where: { email } })
    const sessions = await prisma.session.findMany({ where: { userId: user.id } })
    expect(sessions.length).toBe(2)
  })

  it('rotates refresh tokens and accepts Authorization bearer access token', async () => {
    const loginRes = await login()
    const { accessToken, refreshToken } = loginRes.json()

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(me.statusCode).toBe(200)
    expect(me.json().username).toBe('refresh-token-user')

    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/auth/token/refresh',
      payload: { refreshToken },
    })
    expect(refreshed.statusCode).toBe(200)
    const body = refreshed.json()
    expect(body.accessToken).toBeTruthy()
    expect(body.refreshToken).toBeTruthy()
    expect(body.refreshToken).not.toBe(refreshToken)

    const reused = await app.inject({
      method: 'POST',
      url: '/api/auth/token/refresh',
      payload: { refreshToken },
    })
    // Within grace window this still succeeds
    expect(reused.statusCode).toBe(200)
  })

  it('reuse outside grace revokes the family', async () => {
    const loginRes = await login()
    const { refreshToken } = loginRes.json()
    const first = await app.inject({
      method: 'POST',
      url: '/api/auth/token/refresh',
      payload: { refreshToken },
    })
    expect(first.statusCode).toBe(200)

    const old = await prisma.refreshToken.findFirst({
      where: { revokedAt: { not: null } },
      orderBy: { createdAt: 'asc' },
    })
    expect(old).toBeTruthy()
    await prisma.refreshToken.update({
      where: { id: old!.id },
      data: { revokedAt: new Date(Date.now() - (config.refreshReuseGraceSec + 5) * 1000) },
    })

    const reused = await app.inject({
      method: 'POST',
      url: '/api/auth/token/refresh',
      payload: { refreshToken },
    })
    expect(reused.statusCode).toBe(401)
    expect(reused.json().error).toMatch(/reuse/i)

    const user = await prisma.user.findUniqueOrThrow({ where: { email } })
    const sessions = await prisma.session.findMany({ where: { userId: user.id } })
    expect(sessions.length).toBe(0)
  })

  it('lists and deletes sessions', async () => {
    const loginRes = await login()
    const cookie = loginRes.cookies.find((c) => c.name === 'tahti_session')
    expect(cookie).toBeTruthy()

    const list = await app.inject({
      method: 'GET',
      url: '/api/me/sessions',
      cookies: { tahti_session: cookie!.value },
    })
    expect(list.statusCode).toBe(200)
    expect(list.json().sessions.length).toBeGreaterThanOrEqual(1)
    expect(list.json().sessions.some((s: { current: boolean }) => s.current)).toBe(true)

    const other = await login()
    const otherCookie = other.cookies.find((c) => c.name === 'tahti_session')!
    const sessions = (
      await app.inject({
        method: 'GET',
        url: '/api/me/sessions',
        cookies: { tahti_session: cookie!.value },
      })
    ).json().sessions as Array<{ id: string; current: boolean }>
    const otherId = sessions.find((s) => !s.current)?.id
    expect(otherId).toBeTruthy()

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/me/sessions/${otherId}`,
      cookies: { tahti_session: cookie!.value },
    })
    expect(del.statusCode).toBe(200)

    const otherMe = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { tahti_session: otherCookie.value },
    })
    expect(otherMe.statusCode).toBe(401)
  })
})
