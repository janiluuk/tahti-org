// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createPublishedReleaseWithTrack,
  createReadyArchiveItem,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'archive-editor-test-'

vi.mock('../../lib/queue.js', () => ({
  enqueueVersionTranscode: vi.fn(),
  enqueueBounceArchiveEdit: vi.fn(),
  mediaQueue: { add: vi.fn() },
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

  it('POST /api/me/archive/:id/editor/bounce accepts EQ/HP-LP/compressor fields', async () => {
    const { enqueueBounceArchiveEdit } = await import('../../lib/queue.js')
    vi.mocked(enqueueBounceArchiveEdit).mockClear()
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/archive/${archiveItemId}/editor/bounce`,
      headers: { cookie },
      payload: {
        startSec: 0,
        endSec: 30,
        fadeInSec: 0,
        fadeOutSec: 0,
        peakNormalize: false,
        highPassHz: 80,
        lowPassHz: 16000,
        eq: { lowGainDb: 2, midGainDb: -1.5, highGainDb: 3 },
        compressorEnabled: true,
        versionLabel: 'EQ pass',
        activate: false,
      },
    })
    expect(res.statusCode).toBe(202)
    expect(enqueueBounceArchiveEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        highPassHz: 80,
        lowPassHz: 16000,
        eq: { lowGainDb: 2, midGainDb: -1.5, highGainDb: 3 },
        compressorEnabled: true,
      }),
    )
  })

  it('POST /api/me/archive/:id/editor/publish-to-release creates a release track', async () => {
    const { mediaQueue } = await import('../../lib/queue.js')
    const artist = await prisma.user.findFirst({
      where: { email: `${PREFIX}artist@example.com` },
    })
    const release = await createPublishedReleaseWithTrack(prisma, artist!.id, {
      smartLinkSlug: `${PREFIX}publish`,
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/archive/${archiveItemId}/editor/publish-to-release`,
      headers: { cookie },
      payload: { releaseId: release.id },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { ok: true; trackId: string; status: string }
    expect(body.trackId).toBeTruthy()
    expect(body.status).toBe('SCANNING')
    expect(mediaQueue.add).toHaveBeenCalledWith('transcode-release-track', {
      trackId: body.trackId,
    })

    const track = await prisma.releaseTrack.findUnique({ where: { id: body.trackId } })
    expect(track?.archiveItemId).toBe(archiveItemId)
    expect(track?.title).toBe('Trim target')
  })

  it('POST /api/me/archive/:id/editor/publish-to-release rejects releases not owned by the user', async () => {
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'archive-editor-other',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98522,
    })
    const otherRelease = await createPublishedReleaseWithTrack(prisma, other.id, {
      smartLinkSlug: `${PREFIX}other-release`,
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/archive/${archiveItemId}/editor/publish-to-release`,
      headers: { cookie },
      payload: { releaseId: otherRelease.id },
    })
    expect(res.statusCode).toBe(404)
  })
})
