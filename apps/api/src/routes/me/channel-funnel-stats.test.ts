// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  allocateMemberNumber,
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'funnel-stats-'

describe('M22 — channel funnel stats', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'funnel-stats-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns combined funnel payload', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/channel-funnel-stats',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      downloadGates: { items: unknown[]; daily: unknown[] }
      live: { windowDays: number; daily: unknown[] }
      egress: { windowDays: number; daily: unknown[] }
    }
    expect(body.downloadGates).toBeDefined()
    expect(body.live.windowDays).toBe(14)
    expect(body.egress.windowDays).toBe(30)
    expect(body.live.daily).toHaveLength(14)
    expect(body.egress.daily).toHaveLength(30)
  })
})
