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

const PREFIX = 'release-track-delete-test-'

describe('DELETE /api/me/releases/:id/tracks/:trackId', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let otherCookie: string
  let artistId: string
  let releaseId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'release-track-delete-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    artistId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'release-track-delete-other',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    otherCookie = await sessionCookieFor(prisma, other.id)
  })

  beforeEach(async () => {
    await prisma.release.deleteMany({ where: { userId: artistId } })
    const release = await prisma.release.create({
      data: {
        userId: artistId,
        title: 'Delete Test EP',
        type: 'EP',
        releaseDate: new Date('2026-01-01'),
        smartLinkSlug: `delete-test-${Date.now()}`,
        tracks: {
          create: [
            { position: 1, title: 'One' },
            { position: 2, title: 'Two' },
            { position: 3, title: 'Three' },
          ],
        },
      },
    })
    releaseId = release.id
  })

  afterAll(async () => {
    await prisma.release.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  async function trackTitles() {
    const tracks = await prisma.releaseTrack.findMany({
      where: { releaseId },
      orderBy: { position: 'asc' },
      select: { title: true, position: true },
    })
    return tracks.map((t) => `${t.position}:${t.title}`)
  }

  async function trackId(title: string) {
    const track = await prisma.releaseTrack.findFirstOrThrow({ where: { releaseId, title } })
    return track.id
  }

  it('removes the track and closes the gap in positions', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/me/releases/${releaseId}/tracks/${await trackId('Two')}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(204)
    expect(await trackTitles()).toEqual(['1:One', '2:Three'])
  })

  it("does not touch another artist's release", async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/me/releases/${releaseId}/tracks/${await trackId('One')}`,
      headers: { cookie: otherCookie },
    })
    expect(res.statusCode).toBe(404)
    expect(await trackTitles()).toEqual(['1:One', '2:Two', '3:Three'])
  })

  it('returns 404 for a track on a different release', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/me/releases/${releaseId}/tracks/not-a-track`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('refuses once the release has gone to distribution', async () => {
    await prisma.release.update({ where: { id: releaseId }, data: { revelatorId: 'rv-1' } })
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/me/releases/${releaseId}/tracks/${await trackId('One')}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
    expect(await trackTitles()).toHaveLength(3)
  })
})
