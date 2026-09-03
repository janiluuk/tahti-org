// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

vi.mock('../../lib/queue.js', () => ({
  mediaQueue: { add: vi.fn().mockResolvedValue(undefined) },
}))

const PREFIX = 'mixcloud-test-'

describe('M7 — Mixcloud upload routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let itemId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'mixcloud-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98380,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    const item = await createReadySound(prisma, artist.channel!.id, 'Friday mix')
    itemId = item.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('queues a Mixcloud upload for a READY sound item', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${itemId}/mixcloud`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(202)
    expect(res.json().status).toBe('pending')

    const status = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${itemId}/mixcloud`,
      headers: { cookie },
    })
    expect(status.statusCode).toBe(200)
    expect(status.json().status).toBe('PENDING')
  })

  it('rejects duplicate queue requests', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${itemId}/mixcloud`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().error).toContain('Already queued')
  })

  it('returns 404 for another user’s sound item', async () => {
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'mixcloud-other',
    })
    const otherItem = await createReadySound(prisma, other.channel!.id)

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${otherItem.id}/mixcloud`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(404)
  })
})
