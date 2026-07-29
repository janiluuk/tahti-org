// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'
import { recordUsageDelta } from '../../lib/storage-quota.js'

const PREFIX = 'admin-storage-test-'

describe('GET /api/admin/storage', () => {
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

  it('requires board auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/storage' })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a non-board user', async () => {
    const nonBoard = await createTestArtist(prisma, {
      email: `${PREFIX}non-board@example.com`,
      username: `${PREFIX}non-board`,
    })
    const cookie = await sessionCookieFor(prisma, nonBoard.id)
    const res = await app.inject({ method: 'GET', url: '/api/admin/storage', headers: { cookie } })
    expect(res.statusCode).toBe(403)
  })

  it('reports overall usage and a per-user breakdown', async () => {
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
    })
    const cookie = await sessionCookieFor(prisma, board.id)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    await recordUsageDelta(prisma, artist.id, 12_345)

    const res = await app.inject({ method: 'GET', url: '/api/admin/storage', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const row = body.users.find((u: { userId: string }) => u.userId === artist.id)
    expect(row).toBeDefined()
    expect(row.usedBytes).toBe(12_345)
    expect(body.totalUsedBytes).toBeGreaterThanOrEqual(12_345)
  })
})
