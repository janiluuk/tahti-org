// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'latest-releases-'

describe('GET /api/releases/latest', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'latest-releases-artist',
      displayName: 'Latest Artist',
    })
    await prisma.release.create({
      data: {
        userId: artist.id,
        title: 'Newest Release',
        type: 'EP',
        releaseDate: new Date('2099-01-01T00:00:00.000Z'),
        smartLinkSlug: `${PREFIX}newest`,
        state: 'PUBLISHED',
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('names the artist by display name and username', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/releases/latest?limit=1' })
    expect(res.statusCode).toBe(200)
    const { releases } = res.json() as {
      releases: Array<{ smartLinkSlug: string; artistDisplayName: string; artistUsername: string }>
    }
    expect(releases[0]).toMatchObject({
      smartLinkSlug: `${PREFIX}newest`,
      artistDisplayName: 'Latest Artist',
      artistUsername: 'latest-releases-artist',
    })
  })
})
