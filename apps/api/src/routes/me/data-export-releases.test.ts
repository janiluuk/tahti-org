// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'export-releases-'

describe('GET /api/me/data-export.json — releases', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    await prisma.release.create({
      data: {
        userId: artist.id,
        title: 'Northern EP',
        type: 'EP',
        releaseDate: new Date('2026-09-01T00:00:00Z'),
        smartLinkSlug: `${PREFIX}northern`,
        genre: 'Techno',
        upc: '123456789012',
        tracks: {
          create: [
            { position: 2, title: 'Second', isrc: 'FIXXX2600002', bpm: 128 },
            { position: 1, title: 'First', isrc: 'FIXXX2600001', musicalKey: '8A' },
          ],
        },
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists each release with its metadata and tracks in order', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const [release] = res.json().releases
    expect(release).toMatchObject({ title: 'Northern EP', genre: 'Techno', upc: '123456789012' })
    expect(release.tracks.map((t: { title: string }) => t.title)).toEqual(['First', 'Second'])
    expect(release.tracks[0]).toMatchObject({ isrc: 'FIXXX2600001', musicalKey: '8A' })
    expect(release.tracks[1]).toMatchObject({ bpm: 128 })
  })
})
