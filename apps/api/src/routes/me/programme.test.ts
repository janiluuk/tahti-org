// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { config } from '../../config.js'
import {
  cleanupUsersByEmailPrefix,
  createReadyArchiveItem,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'programme-test-'

describe('M27 — channel fallback programme', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelId: string
  let itemA: string
  let itemB: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'programme-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98610,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    channelId = artist.channel!.id

    const a = await createReadyArchiveItem(prisma, channelId, 'Set A')
    const b = await createReadyArchiveItem(prisma, channelId, 'Set B')
    itemA = a.id
    itemB = b.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET programme lists ready archive items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/channel/programme',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().fallbackMode).toBe('shuffle')
    expect(res.json().items.length).toBeGreaterThanOrEqual(2)
  })

  it('PATCH programme sets rotation flags and ordered mode', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/me/channel/programme',
      headers: { cookie },
      payload: {
        fallbackMode: 'ordered',
        items: [
          { archiveItemId: itemA, isFallback: true, fallbackOrder: 1 },
          { archiveItemId: itemB, isFallback: true, fallbackOrder: 0 },
        ],
      },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().fallbackMode).toBe('ordered')

    const m3u = await app.inject({
      method: 'GET',
      url: `/internal/channels/${channelId}/fallback.m3u`,
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(m3u.statusCode).toBe(200)
    const body = m3u.body as string
    const bPos = body.indexOf('Set B')
    const aPos = body.indexOf('Set A')
    expect(bPos).toBeGreaterThan(-1)
    expect(aPos).toBeGreaterThan(-1)
    expect(bPos).toBeLessThan(aPos)
  })

  it('excludes non-fallback items when at least one is flagged', async () => {
    await prisma.archiveItem.update({
      where: { id: itemA },
      data: { isFallback: false },
    })

    const m3u = await app.inject({
      method: 'GET',
      url: `/internal/channels/${channelId}/fallback.m3u`,
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(m3u.body).toContain('Set B')
    expect(m3u.body).not.toContain('Set A')
  })
})
