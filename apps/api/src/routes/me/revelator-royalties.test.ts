// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

vi.mock('../../lib/queue.js', () => ({
  mediaQueue: { add: vi.fn().mockResolvedValue(undefined) },
}))

const PREFIX = 'revelator-royalty-'

describe('M7 — Revelator royalty routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let releaseId: string
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'revelator-royalty-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98382,
    })
    userId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)

    const create = await app.inject({
      method: 'POST',
      url: '/api/me/releases',
      headers: { cookie, 'content-type': 'application/json' },
      payload: {
        title: 'Royalty Single',
        type: 'SINGLE',
        releaseDate: '2026-06-01',
        tracks: [{ title: 'Track 1' }],
      },
    })
    releaseId = create.json().id

    await prisma.release.update({
      where: { id: releaseId },
      data: {
        revelatorId: 'stub-test-release',
        revelatorStatus: 'submitted',
      },
    })

    await prisma.revelatorRoyaltyReport.create({
      data: {
        userId,
        releaseId,
        revelatorId: 'stub-test-release',
        periodStart: new Date('2026-05-01T00:00:00.000Z'),
        periodEnd: new Date('2026-05-31T23:59:59.999Z'),
        amountCents: 1250,
        currency: 'EUR',
        streams: 100,
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns 401 without session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/releases/${releaseId}/revelator/royalties`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 for another artist release', async () => {
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'revelator-royalty-other',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98396,
    })
    const otherCookie = await sessionCookieFor(prisma, other.id)

    const res = await app.inject({
      method: 'GET',
      url: `/api/me/releases/${releaseId}/revelator/royalties`,
      headers: { cookie: otherCookie },
    })
    expect(res.statusCode).toBe(404)

    await prisma.user.delete({ where: { id: other.id } })
  })

  it('returns empty reports when none synced yet', async () => {
    const emptyRelease = await app.inject({
      method: 'POST',
      url: '/api/me/releases',
      headers: { cookie, 'content-type': 'application/json' },
      payload: {
        title: 'No Royalties Yet',
        type: 'SINGLE',
        releaseDate: '2026-07-01',
        tracks: [{ title: 'Track' }],
      },
    })
    const emptyId = emptyRelease.json().id

    const res = await app.inject({
      method: 'GET',
      url: `/api/me/releases/${emptyId}/revelator/royalties`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().reports).toEqual([])
  })

  it('lists royalties for a release', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/releases/${releaseId}/revelator/royalties`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.reports).toHaveLength(1)
    expect(body.reports[0].releaseId).toBe(releaseId)
    expect(body.reports[0].amountCents).toBeGreaterThan(0)
  })

  it('lists all artist royalties', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/revelator/royalties',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().reports.length).toBeGreaterThanOrEqual(1)
  })
})
