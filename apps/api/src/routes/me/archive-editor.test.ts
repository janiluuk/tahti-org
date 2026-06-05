// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadyArchiveItem,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'archive-editor-test-'

vi.mock('../../lib/queue.js', () => ({
  enqueueVersionTranscode: vi.fn(),
  enqueueBounceArchiveEdit: vi.fn(),
}))

describe('M21 v0 — archive trim editor', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let archiveItemId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'archive-editor-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98521,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    const item = await createReadyArchiveItem(prisma, artist.channel!.id, 'Trim target')
    archiveItemId = item.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET /api/me/archive/:id/editor/source returns presigned url', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/editor/source`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { url: string; title: string; sourceKey: string }
    expect(body.url).toMatch(/^https?:\/\//)
    expect(body.title).toBe('Trim target')
    expect(body.sourceKey).toBeTruthy()
  })

  it('POST /api/me/archive/:id/editor/bounce validates selection', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/archive/${archiveItemId}/editor/bounce`,
      headers: { cookie },
      payload: {
        startSec: 10,
        endSec: 5,
        fadeInSec: 0,
        fadeOutSec: 0,
        peakNormalize: false,
        versionLabel: 'Bad trim',
        activate: true,
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /api/me/archive/:id/editor/bounce enqueues worker job', async () => {
    const { enqueueBounceArchiveEdit } = await import('../../lib/queue.js')
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/archive/${archiveItemId}/editor/bounce`,
      headers: { cookie },
      payload: {
        startSec: 0,
        endSec: 30,
        fadeInSec: 1,
        fadeOutSec: 2,
        peakNormalize: false,
        lufsTarget: 'stream',
        limiterEnabled: true,
        versionLabel: 'Trimmed intro',
        activate: true,
      },
    })
    expect(res.statusCode).toBe(202)
    const body = res.json() as { versionId: string; versionNumber: number; status: string }
    expect(body.versionNumber).toBeGreaterThanOrEqual(2)
    expect(body.status).toBe('PENDING')
    expect(enqueueBounceArchiveEdit).toHaveBeenCalled()
  })
})
