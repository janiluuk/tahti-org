// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'forgot-password-'
const unknownEmailResponse = {
  message: 'If an account exists for that email, we sent a password reset link.',
}

describe('POST /api/auth/forgot-password', () => {
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

  it('issues a working reset token for an account with a password', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: `${PREFIX}user@example.com` },
    })
    expect(res.statusCode).toBe(200)

    const resetRow = await prisma.passwordSetup.findFirst({
      where: { userId: artist.id },
      orderBy: { createdAt: 'desc' },
    })
    expect(resetRow).toBeTruthy()

    const getInfo = await app.inject({
      method: 'GET',
      url: `/api/auth/reset-password?token=${resetRow!.token}`,
    })
    expect(getInfo.statusCode).toBe(200)
    expect(getInfo.json()).toMatchObject({ email: `${PREFIX}user@example.com` })
  })

  it('returns the same generic response for an unknown email (no enumeration)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: `${PREFIX}totally-unknown@example.com` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(unknownEmailResponse)
  })

  it('does not issue a token for an unverified account with no password', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}nopw@example.com`,
      username: `${PREFIX}nopw`,
      emailVerified: false,
    })
    await prisma.user.update({ where: { id: artist.id }, data: { passwordHash: null } })

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: `${PREFIX}nopw@example.com` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(unknownEmailResponse)

    const count = await prisma.passwordSetup.count({ where: { userId: artist.id } })
    expect(count).toBe(0)
  })

  it('lets a verified account without a password (Google/Facebook only) set one', async () => {
    const email = `${PREFIX}social@example.com`
    const artist = await createTestArtist(prisma, { email, username: `${PREFIX}social` })
    await prisma.user.update({ where: { id: artist.id }, data: { passwordHash: null } })

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(unknownEmailResponse)

    const resetRow = await prisma.passwordSetup.findFirstOrThrow({ where: { userId: artist.id } })
    const reset = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: resetRow.token, password: 'FirstPassword123' },
    })
    expect(reset.statusCode).toBe(200)

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'FirstPassword123' },
    })
    expect(login.statusCode).toBe(200)
  })
})
