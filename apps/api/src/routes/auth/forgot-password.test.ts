// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'forgot-password-'

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
    expect(res.json()).toHaveProperty('message')
  })

  it('does not issue a token for a pending account with no password yet', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}nopw@example.com`,
      username: `${PREFIX}nopw`,
    })
    await prisma.user.update({ where: { id: artist.id }, data: { passwordHash: null } })

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: `${PREFIX}nopw@example.com` },
    })
    expect(res.statusCode).toBe(200)

    const count = await prisma.passwordSetup.count({ where: { userId: artist.id } })
    expect(count).toBe(0)
  })
})
