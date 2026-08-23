// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'
import { getRedisClient } from '../../lib/redis.js'

const PREFIX = 'channel-directory-test-'

describe('GET /api/v1/channels/directory', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistSlug: string
  let deletedSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      tier: 'ARTIST',
    })
    artistSlug = artist.channel!.slug
    await prisma.archiveItem.create({
      data: {
        channelId: artist.channel!.id,
        title: 'Directory Test Track',
        status: 'READY',
        isPublic: true,
      },
    })

    // Account deletion anonymizes the user but leaves the channel + archive
    // items in place — must not surface in the public artist directory.
    const deletedArtist = await createTestArtist(prisma, {
      email: `${PREFIX}deleted@example.com`,
      username: `${PREFIX}deleted`,
      tier: 'ARTIST',
    })
    deletedSlug = deletedArtist.channel!.slug
    await prisma.archiveItem.create({
      data: {
        channelId: deletedArtist.channel!.id,
        title: 'Deleted Artist Track',
        status: 'READY',
        isPublic: true,
      },
    })
    await prisma.user.update({
      where: { id: deletedArtist.id },
      data: { deletedAt: new Date() },
    })

    // The route caches its result for 60s under a fixed key — clear it so
    // this test's requests see the fixtures just created, not a stale hit.
    const redis = await getRedisClient()
    await redis?.del('channels:directory')
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('includes an active artist with a public archive item', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/channels/directory' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: Array<{ slug: string; username: string }> }
    expect(body.items.some((item) => item.slug === artistSlug && item.username === `${PREFIX}artist`)).toBe(true)
  })

  it('excludes a deleted user’s channel', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/channels/directory' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: Array<{ slug: string }> }
    expect(body.items.some((i) => i.slug === deletedSlug)).toBe(false)
  })
})
