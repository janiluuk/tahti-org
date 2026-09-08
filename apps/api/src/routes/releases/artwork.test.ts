// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist, sessionCookieFor } from '../../test/helpers.js'

const PREFIX = 'release-artwork-test-'

describe('release artwork', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let releaseId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'release-artwork-test-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98401,
    })
    cookie = await sessionCookieFor(prisma, artist.id)

    const create = await app.inject({
      method: 'POST',
      url: '/api/me/releases',
      headers: { cookie },
      payload: {
        title: 'Artwork Test EP',
        type: 'EP',
        releaseDate: '2026-01-15',
        tracks: [{ title: 'Track One', durationSec: 240 }],
      },
    })
    releaseId = create.json().id

    await prisma.release.update({
      where: { id: releaseId },
      data: { artworkKey: `releases/release-artwork-test-artist/${releaseId}/artwork-x.jpg` },
    })
  })

  afterAll(async () => {
    await prisma.release.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('clears artworkKey and artworkUrl on delete', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/me/releases/${releaseId}/artwork`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ artworkUrl: null, artworkKey: null })

    const updated = await prisma.release.findUniqueOrThrow({ where: { id: releaseId } })
    expect(updated.artworkKey).toBeNull()
    expect(updated.artworkUrl).toBeNull()
  })

  it('404s for a release owned by someone else', async () => {
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'release-artwork-test-other',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98402,
    })
    const otherCookie = await sessionCookieFor(prisma, other.id)
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/me/releases/${releaseId}/artwork`,
      headers: { cookie: otherCookie },
    })
    expect(res.statusCode).toBe(404)
  })
})
