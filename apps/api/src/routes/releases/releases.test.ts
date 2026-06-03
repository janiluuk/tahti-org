// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'release-test-'

describe('M12 — releases and public profile', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let username: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    username = 'release-test-artist'
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98400,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await prisma.release.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('creates a draft release and publishes it', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/releases',
      headers: { cookie },
      payload: {
        title: 'Midnight EP',
        type: 'EP',
        releaseDate: '2026-01-15',
        tracks: [
          { title: 'Track One', durationSec: 240 },
          { title: 'Track Two', durationSec: 300 },
        ],
      },
    })
    expect(create.statusCode).toBe(201)
    const id = create.json().id

    const pub = await app.inject({
      method: 'PATCH',
      url: `/api/me/releases/${id}`,
      headers: { cookie },
      payload: { state: 'PUBLISHED' },
    })
    expect(pub.statusCode).toBe(200)
    expect(pub.json().state).toBe('PUBLISHED')
  })

  it('shows published releases on public profile only', async () => {
    const profile = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${username}/profile`,
    })
    expect(profile.statusCode).toBe(200)
    expect(profile.json().releases).toHaveLength(1)
    expect(profile.json().releases[0].title).toBe('Midnight EP')
    expect(profile.json().links.channel).toBe(`/c/${username}`)
    expect(Array.isArray(profile.json().collections)).toBe(true)

    const release = await prisma.release.findFirst({
      where: { user: { username }, state: 'PUBLISHED' },
    })
    await prisma.release.update({
      where: { id: release!.id },
      data: {
        smartLinkTargets: {
          spotify: 'https://open.spotify.com/album/1',
          bandcamp: 'https://x.bandcamp.com',
        },
      },
    })
    const link = await app.inject({
      method: 'GET',
      url: `/api/v1/r/${release!.smartLinkSlug}`,
    })
    expect(link.statusCode).toBe(200)
    expect(link.json().releaseUrl).toContain(`/u/${username}`)
    expect(link.json().releaseUrl).toContain('release-')
    expect(link.json().targets.spotify).toContain('spotify.com')
    expect(link.json().embedUrl).toContain(`/embed/r/${release!.id}`)
  })

  it('updates smart link targets on a release', async () => {
    const release = await prisma.release.findFirst({
      where: { user: { username }, state: 'PUBLISHED' },
    })
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/me/releases/${release!.id}`,
      headers: { cookie },
      payload: {
        smartLinkTargets: { tidal: 'https://listen.tidal.com/album/1' },
      },
    })
    expect(patch.statusCode).toBe(200)

    const link = await app.inject({
      method: 'GET',
      url: `/api/v1/r/${release!.smartLinkSlug}`,
    })
    expect(link.json().targets.tidal).toContain('tidal.com')
  })

  it('rejects publishing a release with no tracks', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/releases',
      headers: { cookie },
      payload: {
        title: 'Empty',
        type: 'SINGLE',
        releaseDate: '2026-02-01',
        tracks: [],
      },
    })
    const id = create.json().id
    const pub = await app.inject({
      method: 'PATCH',
      url: `/api/me/releases/${id}`,
      headers: { cookie },
      payload: { state: 'PUBLISHED' },
    })
    expect(pub.statusCode).toBe(400)
  })

  it('updates release catalog metadata and returns checklist', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/me/releases',
      headers: { cookie },
    })
    const id = list.json()[0].id

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/me/releases/${id}/catalog`,
      headers: { cookie },
      payload: {
        upc: '1234567890123',
        musicbrainzReleaseId: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
        pLine: '℗ 2026 Tahti Demo',
      },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().upc).toBe('1234567890123')
    expect(Array.isArray(patch.json().checklist)).toBe(true)
    expect(patch.json().checklist.find((s: { id: string }) => s.id === 'identifiers')?.done).toBe(
      true,
    )

    const exp = await app.inject({
      method: 'GET',
      url: `/api/me/releases/${id}/export.json`,
      headers: { cookie },
    })
    expect(exp.statusCode).toBe(200)
    expect(exp.json().release.upc).toBe('1234567890123')
  })
})
