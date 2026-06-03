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

const PREFIX = 'revelator-test-'

describe('M7 — Revelator submit routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let releaseId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'revelator-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98381,
    })
    cookie = await sessionCookieFor(prisma, artist.id)

    const create = await app.inject({
      method: 'POST',
      url: '/api/me/releases',
      headers: { cookie, 'content-type': 'application/json' },
      payload: {
        title: 'Test Single',
        type: 'SINGLE',
        releaseDate: '2026-06-01',
        tracks: [{ title: 'Track 1' }],
      },
    })
    releaseId = create.json().id

    await prisma.release.update({
      where: { id: releaseId },
      data: { upc: '123456789012' },
    })
    await prisma.releaseTrack.updateMany({
      where: { releaseId },
      data: { isrc: 'FI-TEST-0001' },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('queues Revelator delivery for a release with identifiers', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/releases/${releaseId}/revelator/submit`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(202)
    expect(res.json().revelatorStatus).toBe('pending')

    const row = await prisma.release.findUnique({ where: { id: releaseId } })
    expect(row?.revelatorStatus).toBe('pending')
  })

  it('rejects duplicate submit while in flight', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/releases/${releaseId}/revelator/submit`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
  })
})
