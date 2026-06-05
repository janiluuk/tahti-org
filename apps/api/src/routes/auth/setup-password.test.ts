// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'
import { createPasswordSetupToken } from '../../lib/password-setup.js'

const PREFIX = 'setup-password-'

describe('POST /api/auth/setup-password', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let token: string
  const email = `${PREFIX}user@example.com`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: null,
        username: 'setup-password-user',
        displayName: 'Setup User',
        emailVerifiedAt: new Date(),
        membership: { create: { status: 'PENDING_PAYMENT' } },
        channel: {
          create: {
            slug: 'setup-password-user',
            liveSourceMount: '/live/setup-password-user',
            liveSourcePass: 'pass',
            liveSourcePassHash: 'hash',
            rtmpStreamKey: 'setup-password-user__key',
            rtmpStreamKeyHash: 'hash',
          },
        },
      },
    })
    token = await createPasswordSetupToken(prisma, user.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET returns account info for valid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/auth/setup-password?token=${encodeURIComponent(token)}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { email: string; username: string }
    expect(body.email).toBe(email)
    expect(body.username).toBe('setup-password-user')
  })

  it('POST sets password and creates session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/setup-password',
      payload: { token, password: 'newpassword123' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.cookies.some((c) => c.name === 'tahti_session')).toBe(true)

    const user = await prisma.user.findUnique({
      where: { email },
      select: { passwordHash: true },
    })
    expect(user?.passwordHash).toBeTruthy()

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'newpassword123' },
    })
    expect(login.statusCode).toBe(200)
  })

  it('rejects login before password is set', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}nopw@example.com`,
      username: 'setup-password-nopw',
    })
    await prisma.user.update({
      where: { id: artist.id },
      data: { passwordHash: null, emailVerifiedAt: new Date() },
    })

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${PREFIX}nopw@example.com`, password: 'anything' },
    })
    expect(login.statusCode).toBe(401)
  })
})
