// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadyArchiveItem,
  createTestArtist,
  sessionCookieFor,
} from '../test/helpers.js'

const PREFIX = 'user-storage-test-'

describe('computeUserStorageUsedBytes via /api/auth/me', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let memberCookie: string
  let freeCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: 'user-storage-member',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 99101,
    })
    memberCookie = await sessionCookieFor(prisma, member.id)
    await createReadyArchiveItem(prisma, member.channel!.id, 'Member track')

    const free = await createTestArtist(prisma, {
      email: `${PREFIX}free@example.com`,
      username: 'user-storage-free',
      tier: 'FREE',
      isMember: false,
      memberNumber: 99102,
    })
    freeCookie = await sessionCookieFor(prisma, free.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns live archive usage for members without a cap display', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: memberCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      storage: { usedBytes: string; softTargetBytes?: string; showSoftTarget: boolean }
    }
    expect(Number(body.storage.usedBytes)).toBeGreaterThanOrEqual(5_000_000)
    expect(body.storage.showSoftTarget).toBe(false)
    expect(body.storage.softTargetBytes).toBeUndefined()
  })

  it('returns soft target for free tier accounts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: freeCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      storage: { usedBytes: string; softTargetBytes?: string; showSoftTarget: boolean }
    }
    expect(body.storage.showSoftTarget).toBe(true)
    expect(body.storage.softTargetBytes).toBe('524288000')
  })
})
