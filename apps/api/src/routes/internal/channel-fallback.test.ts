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
} from '../../test/helpers.js'

const PREFIX = 'fallback-played-'

describe('M27 — fallback played callback', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let channelId: string
  let itemId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'fallback-played-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98620,
    })
    channelId = artist.channel!.id
    const item = await createReadyArchiveItem(prisma, channelId, 'Rotation track')
    itemId = item.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('updates lastFallbackPlayedAt for internal callers', async () => {
    const before = await prisma.archiveItem.findUnique({
      where: { id: itemId },
      select: { lastFallbackPlayedAt: true },
    })
    expect(before?.lastFallbackPlayedAt).toBeNull()

    const res = await app.inject({
      method: 'POST',
      url: `/internal/channels/${channelId}/fallback-played`,
      headers: { authorization: `Bearer ${config.internalSecret}` },
      payload: { archiveItemId: itemId },
    })
    expect(res.statusCode).toBe(200)

    const after = await prisma.archiveItem.findUnique({
      where: { id: itemId },
      select: { lastFallbackPlayedAt: true },
    })
    expect(after?.lastFallbackPlayedAt).toBeTruthy()
  })
})
