// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'
import { createPasswordSetupToken } from '../../lib/password-setup.js'
import { createSession } from '../../lib/session.js'

const PREFIX = 'reset-password-'

describe('GET/POST /api/auth/reset-password', () => {
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

  it('rejects an invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/reset-password?token=not-a-real-token',
    })
    expect(res.statusCode).toBe(400)
  })

  it('resets the password for an account that already has one, revoking old sessions', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })
    const oldSession = await createSession(prisma, artist.id)
    const token = await createPasswordSetupToken(prisma, artist.id)

    const info = await app.inject({
      method: 'GET',
      url: `/api/auth/reset-password?token=${token}`,
    })
    expect(info.statusCode).toBe(200)

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token, password: 'brandnewpassword123' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.cookies.some((c) => c.name === 'tahti_session')).toBe(true)

    const survivingSession = await prisma.session.findUnique({ where: { id: oldSession.id } })
    expect(survivingSession).toBeNull()

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${PREFIX}user@example.com`, password: 'brandnewpassword123' },
    })
    expect(login.statusCode).toBe(200)
  })

  it('rejects a reused token', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}reuse@example.com`,
      username: `${PREFIX}reuse`,
    })
    const token = await createPasswordSetupToken(prisma, artist.id)

    const first = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token, password: 'firstnewpassword123' },
    })
    expect(first.statusCode).toBe(200)

    const second = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token, password: 'secondnewpassword123' },
    })
    expect(second.statusCode).toBe(400)
  })
})
