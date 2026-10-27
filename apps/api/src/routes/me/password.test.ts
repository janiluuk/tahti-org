// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'me-password-'

describe('POST /api/me/password', () => {
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

  const change = (cookie: string, payload: object) =>
    app.inject({ method: 'POST', url: '/api/me/password', headers: { cookie }, payload })

  const login = (password: string) =>
    app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${PREFIX}user@example.com`, password },
    })

  it('refuses a wrong current password or a weak new one', async () => {
    const cookie = await sessionCookieFor(prisma, userId)
    const wrong = await change(cookie, { currentPassword: 'nope', newPassword: 'NewPassword123' })
    expect(wrong.statusCode).toBe(400)
    expect(wrong.json().error).toBe('Current password is wrong')
    const weak = await change(cookie, { currentPassword: 'testpassword', newPassword: 'short' })
    expect(weak.statusCode).toBe(400)
  })

  it('changes it, keeps this session and signs out the others', async () => {
    const mine = await sessionCookieFor(prisma, userId)
    const other = await sessionCookieFor(prisma, userId)
    const res = await change(mine, {
      currentPassword: 'testpassword',
      newPassword: 'NewPassword123',
    })
    expect(res.statusCode).toBe(200)

    const me = (cookie: string) =>
      app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })
    expect((await me(mine)).statusCode).toBe(200)
    expect((await me(other)).statusCode).toBe(401)

    expect((await login('testpassword')).statusCode).toBe(401)
    expect((await login('NewPassword123')).statusCode).toBe(200)
  })

  it('needs a signed-in session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/password',
      payload: { currentPassword: 'a', newPassword: 'NewPassword123' },
    })
    expect(res.statusCode).toBe(401)
  })
})
