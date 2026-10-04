// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  allocateMemberNumber,
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'release-track-reorder-test-'

describe('PUT /api/me/releases/:id/tracks/reorder', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let artistId: string
  let releaseId: string
  let ids: Record<string, string>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'release-track-reorder-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    artistId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  beforeEach(async () => {
    await prisma.release.deleteMany({ where: { userId: artistId } })
    const release = await prisma.release.create({
      data: {
        userId: artistId,
        title: 'Reorder Test EP',
        type: 'EP',
        releaseDate: new Date('2026-01-01'),
        smartLinkSlug: `reorder-test-${Date.now()}`,
        tracks: {
          create: [
            { position: 1, title: 'One' },
            { position: 2, title: 'Two' },
            { position: 3, title: 'Three' },
          ],
        },
      },
      include: { tracks: true },
    })
    releaseId = release.id
    ids = Object.fromEntries(release.tracks.map((t) => [t.title, t.id]))
  })

  afterAll(async () => {
    await prisma.release.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  async function order() {
    const tracks = await prisma.releaseTrack.findMany({
      where: { releaseId },
      orderBy: { position: 'asc' },
      select: { title: true },
    })
    return tracks.map((t) => t.title)
  }

  function reorder(trackIds: string[]) {
    return app.inject({
      method: 'PUT',
      url: `/api/me/releases/${releaseId}/tracks/reorder`,
      headers: { cookie },
      payload: { trackIds },
    })
  }

  it('writes the new order', async () => {
    const res = await reorder([ids.Three!, ids.One!, ids.Two!])
    expect(res.statusCode).toBe(200)
    expect(await order()).toEqual(['Three', 'One', 'Two'])
  })

  it('rejects a list that leaves a track out', async () => {
    const res = await reorder([ids.Two!, ids.One!])
    expect(res.statusCode).toBe(400)
    expect(await order()).toEqual(['One', 'Two', 'Three'])
  })

  it('rejects duplicates and foreign ids', async () => {
    expect((await reorder([ids.One!, ids.One!, ids.Two!])).statusCode).toBe(400)
    expect((await reorder([ids.One!, ids.Two!, 'elsewhere'])).statusCode).toBe(400)
    expect(await order()).toEqual(['One', 'Two', 'Three'])
  })

  it('refuses once the release has gone to distribution', async () => {
    await prisma.release.update({ where: { id: releaseId }, data: { revelatorId: 'rv-2' } })
    const res = await reorder([ids.Three!, ids.Two!, ids.One!])
    expect(res.statusCode).toBe(409)
  })
})
