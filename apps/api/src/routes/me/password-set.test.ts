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

const PREFIX = 'me-password-set-'

describe('POST /api/me/password/set', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  async function socialOnlyUser(name: string) {
    const email = `${PREFIX}${name}@example.com`
    const user = await createTestArtist(prisma, { email, username: `${PREFIX}${name}` })
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: null } })
    return { id: user.id, email }
  }

  const setPassword = (cookie: string, payload: object) =>
    app.inject({ method: 'POST', url: '/api/me/password/set', headers: { cookie }, payload })

  const me = (cookie: string) =>
    app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })

  it('needs a signed-in session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/password/set',
      payload: { password: 'FirstPassword123' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('applies the signup password rules', async () => {
    const user = await socialOnlyUser('weak')
    const res = await setPassword(await sessionCookieFor(prisma, user.id), { password: 'short' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBeTruthy()
  })

  it('sets the first password, keeps every session and enables password sign-in', async () => {
    const user = await socialOnlyUser('first')
    const mine = await sessionCookieFor(prisma, user.id)
    const other = await sessionCookieFor(prisma, user.id)
    expect((await me(mine)).json().hasPassword).toBe(false)

    const res = await setPassword(mine, { password: 'FirstPassword123' })
    expect(res.statusCode).toBe(204)
    expect(res.body).toBe('')

    expect((await me(mine)).json().hasPassword).toBe(true)
    expect((await me(other)).statusCode).toBe(200)
    expect(sendSecurityNotice).toHaveBeenCalledWith(
      expect.objectContaining({ to: user.email }),
      expect.anything(),
    )

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, password: 'FirstPassword123' },
    })
    expect(login.statusCode).toBe(200)

    const again = await setPassword(mine, { password: 'OtherPassword123' })
    expect(again.statusCode).toBe(409)
    expect(again.json().error).toBeTruthy()
  })

  it('refuses an account that already has a password', async () => {
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}haspw@example.com`,
      username: `${PREFIX}haspw`,
    })
    const cookie = await sessionCookieFor(prisma, user.id)
    expect((await me(cookie)).json().hasPassword).toBe(true)
    const res = await setPassword(cookie, { password: 'FirstPassword123' })
    expect(res.statusCode).toBe(409)
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${PREFIX}haspw@example.com`, password: 'testpassword' },
    })
    expect(login.statusCode).toBe(200)
  })
})
