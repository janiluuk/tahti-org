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

const PREFIX = 'release-delete-test-'

describe('DELETE /api/me/releases/:id', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let otherCookie: string
  let artistId: string
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'release-delete-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    artistId = artist.id
    channelId = artist.channel!.id
    cookie = await sessionCookieFor(prisma, artist.id)
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'release-delete-other',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    otherCookie = await sessionCookieFor(prisma, other.id)
  })

  afterAll(async () => {
    await prisma.release.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const createRelease = (extra: { revelatorId?: string } = {}) =>
    prisma.release.create({
      data: {
        userId: artistId,
        title: 'Delete Me EP',
        type: 'EP',
        releaseDate: new Date('2026-01-01'),
        smartLinkSlug: `release-delete-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        tracks: { create: [{ position: 1, title: 'One' }] },
        ...extra,
      },
    })

  const del = (id: string, withCookie = cookie) =>
    app.inject({
      method: 'DELETE',
      url: `/api/me/releases/${id}`,
      headers: { cookie: withCookie },
    })

  it('deletes the release and its tracklist but keeps sounds', async () => {
    const release = await createRelease()
    const sound = await prisma.sound.create({
      data: { channelId, title: 'Kept Sound', status: 'READY', isPublic: true },
    })
    const collection = await prisma.collection.create({
      data: {
        userId: artistId,
        slug: `${PREFIX}${Date.now()}`,
        name: 'Mix',
        items: {
          create: [
            { position: 1, releaseId: release.id },
            { position: 2, soundId: sound.id },
          ],
        },
      },
    })

    expect((await del(release.id)).statusCode).toBe(204)
    expect(await prisma.release.findUnique({ where: { id: release.id } })).toBeNull()
    expect(await prisma.releaseTrack.count({ where: { releaseId: release.id } })).toBe(0)
    expect(await prisma.sound.findUnique({ where: { id: sound.id } })).not.toBeNull()
    const items = await prisma.collectionItem.findMany({
      where: { collectionId: collection.id },
      select: { soundId: true },
    })
    expect(items).toEqual([{ soundId: sound.id }])
  })

  it('refuses a release that has been sent for distribution', async () => {
    const release = await createRelease({ revelatorId: 'rev-123' })
    const res = await del(release.id)
    expect(res.statusCode).toBe(409)
    expect(await prisma.release.findUnique({ where: { id: release.id } })).not.toBeNull()
  })

  it("answers 404 for someone else's release and 401 when signed out", async () => {
    const release = await createRelease()
    expect((await del(release.id, otherCookie)).statusCode).toBe(404)
    expect(
      (await app.inject({ method: 'DELETE', url: `/api/me/releases/${release.id}` })).statusCode,
    ).toBe(401)
    expect(await prisma.release.findUnique({ where: { id: release.id } })).not.toBeNull()
  })
})
