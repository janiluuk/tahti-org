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

const PREFIX = 'track-versions-'

describe('GET /api/me/releases/:releaseId/tracks/:trackId/versions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let releaseId: string
  let trackId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'track-versions-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98393,
    })
    cookie = await sessionCookieFor(prisma, artist.id)

    const create = await app.inject({
      method: 'POST',
      url: '/api/me/releases',
      headers: { cookie, 'content-type': 'application/json' },
      payload: {
        title: 'Version Test EP',
        type: 'EP',
        releaseDate: '2026-06-01',
        tracks: [{ title: 'Main track', durationSec: 200 }],
      },
    })
    releaseId = create.json().id
    trackId = create.json().tracks[0].id

    await prisma.releaseTrack.update({
      where: { id: trackId },
      data: {
        status: 'READY',
        sourceKey: `releases/${releaseId}/${trackId}.wav`,
        sourceFormat: 'wav',
        durationSec: 200,
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns an empty list before audio is uploaded', async () => {
    const draft = await app.inject({
      method: 'POST',
      url: '/api/me/releases',
      headers: { cookie, 'content-type': 'application/json' },
      payload: {
        title: 'Draft only',
        type: 'SINGLE',
        releaseDate: '2026-08-01',
        tracks: [{ title: 'Unuploaded' }],
      },
    })
    const draftTrackId = draft.json().tracks[0].id

    const res = await app.inject({
      method: 'GET',
      url: `/api/me/releases/${draft.json().id}/tracks/${draftTrackId}/versions`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('lists track versions (backfills initial version for ready tracks)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/releases/${releaseId}/tracks/${trackId}/versions`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const versions = res.json()
    expect(Array.isArray(versions)).toBe(true)
    expect(versions.length).toBeGreaterThanOrEqual(1)
    expect(versions[0]).toMatchObject({
      versionNumber: expect.any(Number),
      versionLabel: expect.any(String),
      status: expect.any(String),
      isActive: expect.any(Boolean),
    })
  })

  it('returns 404 for another artist track', async () => {
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'track-versions-other',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98394,
    })
    const otherCookie = await sessionCookieFor(prisma, other.id)

    const res = await app.inject({
      method: 'GET',
      url: `/api/me/releases/${releaseId}/tracks/${trackId}/versions`,
      headers: { cookie: otherCookie },
    })
    expect(res.statusCode).toBe(404)

    await prisma.user.delete({ where: { id: other.id } })
  })
})
