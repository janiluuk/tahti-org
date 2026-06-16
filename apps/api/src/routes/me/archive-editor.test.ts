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
  enqueueVersionTranscode: vi.fn().mockResolvedValue(undefined),
  enqueueRenderArchiveEdit: vi.fn().mockResolvedValue(undefined),
  enqueueBackfillEditorPeaks: vi.fn().mockResolvedValue(undefined),
  mediaQueue: { add: vi.fn() },
}))

vi.mock('../../lib/minio.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/minio.js')>()
  return {
    ...actual,
    getObjectStream: vi.fn().mockResolvedValue({
      body: Buffer.from('fake-audio'),
      contentType: 'audio/flac',
      contentLength: 10,
    }),
  }
})

describe('M21 v0 — archive trim editor', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let archiveItemId: string
  let otherArchiveItemId: string

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

    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other2@example.com`,
      username: 'archive-editor-other2',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98523,
    })
    const otherItem = await createReadyArchiveItem(prisma, other.channel!.id, 'Other trim target')
    otherArchiveItemId = otherItem.id
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

  it('GET /api/me/archive/:id/editor/stream returns audio with CORP header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/editor/stream`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin')
    expect(res.headers['content-type']).toMatch(/audio\/flac/)
    expect(res.body).toBe('fake-audio')
  })

  it('GET /api/me/archive/:id/editor/draft enqueues editorPeaks backfill when missing', async () => {
    const { enqueueBackfillEditorPeaks } = await import('../../lib/queue.js')
    vi.mocked(enqueueBackfillEditorPeaks).mockClear()

    const res = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/editor/draft`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(enqueueBackfillEditorPeaks).toHaveBeenCalledWith(archiveItemId)
  })

  it('POST /api/me/archive/:id/editor/render returns 429 when two jobs are already active', async () => {
    const artist = await prisma.user.findFirst({
      where: { email: `${PREFIX}artist@example.com` },
      include: { channel: true },
    })
    const item2 = await createReadyArchiveItem(prisma, artist!.channel!.id, 'Concurrent render')

    const v1Num = (await prisma.archiveItemVersion.count({ where: { archiveItemId } })) + 100
    const v2Num =
      (await prisma.archiveItemVersion.count({ where: { archiveItemId: item2.id } })) + 100

    await prisma.archiveItemVersion.createMany({
      data: [
        {
          archiveItemId,
          versionNumber: v1Num,
          versionLabel: `${PREFIX}pending-1`,
          rawKey: 'pending/test/1',
          fileSizeBytes: 0,
          status: 'PENDING',
          isActive: false,
        },
        {
          archiveItemId: item2.id,
          versionNumber: v2Num,
          versionLabel: `${PREFIX}pending-2`,
          rawKey: 'pending/test/2',
          fileSizeBytes: 0,
          status: 'PENDING',
          isActive: false,
        },
      ],
    })

    try {
      const draftRes = await app.inject({
        method: 'GET',
        url: `/api/me/archive/${archiveItemId}/editor/draft`,
        headers: { cookie },
      })
      const { editList } = draftRes.json() as { editList: Record<string, unknown> }

      const res = await app.inject({
        method: 'POST',
        url: `/api/me/archive/${archiveItemId}/editor/render`,
        headers: { cookie },
        payload: {
          editList,
          versionLabel: 'Blocked render',
          activate: false,
          format: 'flac',
        },
      })
      expect(res.statusCode).toBe(429)
      expect(res.json()).toMatchObject({ error: expect.stringContaining('max 2') })
    } finally {
      await prisma.archiveItemVersion.deleteMany({
        where: { versionLabel: { startsWith: `${PREFIX}pending` } },
      })
    }
  })

  it('POST /api/me/archive/:id/editor/bounce returns 410 Gone', async () => {
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
        versionLabel: 'Trimmed intro',
        activate: true,
      },
    })
    expect(res.statusCode).toBe(410)
    expect(res.headers.deprecation).toBe('true')
    expect(res.json()).toMatchObject({ error: expect.stringContaining('editor/render') })
  })

  it('POST /api/me/archive/:id/editor/render enqueues worker job', async () => {
    const { enqueueRenderArchiveEdit } = await import('../../lib/queue.js')
    vi.mocked(enqueueRenderArchiveEdit).mockClear()

    const draftRes = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/editor/draft`,
      headers: { cookie },
    })
    const { editList } = draftRes.json() as { editList: Record<string, unknown> }

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/archive/${archiveItemId}/editor/render`,
      headers: { cookie },
      payload: {
        editList,
        versionLabel: 'Pro render test',
        activate: false,
        format: 'flac',
      },
    })
    expect(res.statusCode).toBe(202)
    const body = res.json() as { versionId: string; versionNumber: number; status: string }
    expect(body.versionId).toBeTruthy()
    expect(body.status).toBe('PENDING')
    expect(enqueueRenderArchiveEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        archiveItemId,
        format: 'flac',
        activate: false,
      }),
    )
  })

  it('POST /api/me/archive/:id/editor/render passes preview sample options to worker', async () => {
    const { enqueueRenderArchiveEdit } = await import('../../lib/queue.js')
    vi.mocked(enqueueRenderArchiveEdit).mockClear()

    const draftRes = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/editor/draft`,
      headers: { cookie },
    })
    const { editList } = draftRes.json() as { editList: Record<string, unknown> }

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/archive/${archiveItemId}/editor/render`,
      headers: { cookie },
      payload: {
        editList,
        versionLabel: 'Preview sample',
        activate: false,
        format: 'mp3',
        maxDurationSec: 30,
        sampleOnly: true,
      },
    })
    expect(res.statusCode).toBe(202)
    expect(enqueueRenderArchiveEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'mp3',
        sampleOnly: true,
        maxDurationSec: 30,
        activate: false,
      }),
    )
  })

  it('POST /api/me/archive/:id/editor/render rejects invalid editList', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/archive/${archiveItemId}/editor/render`,
      headers: { cookie },
      payload: {
        editList: { version: 1, sourceDuration: 120, cuts: [{ start: 0, end: 120 }] },
        versionLabel: 'Bad edit',
        format: 'flac',
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/me/archive/:id/editor/source rejects an archive item owned by another user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${otherArchiveItemId}/editor/source`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('POST /api/me/archive/:id/editor/bounce rejects an archive item owned by another user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/archive/${otherArchiveItemId}/editor/bounce`,
      headers: { cookie },
      payload: {
        startSec: 0,
        endSec: 10,
        versionLabel: 'Hijack attempt',
        activate: true,
      },
    })
    expect(res.statusCode).toBe(410)
  })

  it('POST /api/me/archive/:id/editor/bounce rejects an endSec that overflows to Infinity', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/archive/${archiveItemId}/editor/bounce`,
      headers: { cookie, 'content-type': 'application/json' },
      payload: '{"startSec":0,"endSec":1e400,"versionLabel":"Overflow attempt","activate":true}',
    })
    expect(res.statusCode).toBe(410)
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

  it('POST /api/me/archive/:id/editor/publish-to-release rejects versionId from another archive', async () => {
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other3@example.com`,
      username: 'archive-editor-other3',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98524,
    })
    const otherItem = await createReadyArchiveItem(
      prisma,
      other.channel!.id,
      'Other version source',
    )
    await prisma.archiveItemVersion.create({
      data: {
        archiveItemId: otherItem.id,
        versionNumber: 2,
        versionLabel: `${PREFIX}foreign-version`,
        rawKey: 'raw/other/foreign.wav',
        fileSizeBytes: 1000,
        status: 'READY',
        isActive: false,
      },
    })
    const foreignVersion = await prisma.archiveItemVersion.findFirst({
      where: { archiveItemId: otherItem.id, versionNumber: 2 },
    })

    const artist = await prisma.user.findFirst({
      where: { email: `${PREFIX}artist@example.com` },
    })
    const release = await createPublishedReleaseWithTrack(prisma, artist!.id, {
      smartLinkSlug: `${PREFIX}publish-version-guard`,
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/archive/${archiveItemId}/editor/publish-to-release`,
      headers: { cookie },
      payload: { releaseId: release.id, versionId: foreignVersion!.id },
    })
    expect(res.statusCode).toBe(404)
  })

  it('PATCH /api/me/archive/:id/editor/draft rejects oversized editList payload', async () => {
    const draftRes = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/editor/draft`,
      headers: { cookie },
    })
    const { editList } = draftRes.json() as { editList: Record<string, unknown> }
    const huge = {
      editList: {
        ...editList,
        cuts: Array.from({ length: 4000 }, (_, i) => ({
          start: i * 0.01,
          end: i * 0.01 + 0.005,
        })),
      },
    }

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/me/archive/${archiveItemId}/editor/draft`,
      headers: { cookie },
      payload: huge,
    })
    expect(res.statusCode).toBe(400)
  })

  it('PATCH /api/me/archive/:id/editor/draft returns 409 on stale expectedUpdatedAt', async () => {
    const draftRes = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/editor/draft`,
      headers: { cookie },
    })
    const { editList, updatedAt } = draftRes.json() as {
      editList: Record<string, unknown>
      updatedAt: string
    }

    await app.inject({
      method: 'PATCH',
      url: `/api/me/archive/${archiveItemId}/editor/draft`,
      headers: { cookie },
      payload: { editList, expectedUpdatedAt: updatedAt },
    })

    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/me/archive/${archiveItemId}/editor/draft`,
      headers: { cookie },
      payload: { editList, expectedUpdatedAt: updatedAt },
    })
    expect(stale.statusCode).toBe(409)
    expect(stale.json()).toMatchObject({ error: expect.stringContaining('elsewhere') })
  })
})
