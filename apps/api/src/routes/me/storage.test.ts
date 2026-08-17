// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createReadyArchiveItem,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'me-storage-test-'
const DEFAULT_SOFT_TARGET_BYTES = 500 * 1024 * 1024

describe('GET /api/me/storage', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/storage' })
    expect(res.statusCode).toBe(401)
  })

  // docs/storage-policy.md: same 500MB soft display target for every tier —
  // not a hard cap, and not scaled by membership/tier.
  it('reports the 500MB soft target with zero usage for a fresh account', async () => {
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
    })
    const cookie = await sessionCookieFor(prisma, owner.id)

    const res = await app.inject({
      method: 'GET',
      url: '/api/me/storage',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.quotaBytes).toBe(DEFAULT_SOFT_TARGET_BYTES)
    expect(body.usedBytes).toBe(0)
  })

  it('reflects real archive usage, even well past the soft target — never blocked', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}heavy@example.com`,
      username: `${PREFIX}heavy`,
    })
    const cookie = await sessionCookieFor(prisma, artist.id)
    await createReadyArchiveItem(prisma, artist.channel!.id, 'Track one')

    const res = await app.inject({
      method: 'GET',
      url: '/api/me/storage',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.usedBytes).toBe(5_000_000)
    expect(body.quotaBytes).toBe(DEFAULT_SOFT_TARGET_BYTES)
  })
})
