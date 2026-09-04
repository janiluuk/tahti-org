// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createPublishedReleaseWithTrack,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'sound-editor-test-'

vi.mock('../../lib/queue.js', () => ({
  enqueueVersionTranscode: vi.fn().mockResolvedValue(undefined),
  enqueueRenderSoundEdit: vi.fn().mockResolvedValue(undefined),
  enqueueRenderAnnouncementTrim: vi.fn().mockResolvedValue(undefined),
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

describe('M21 v0 — sound trim editor', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let soundId: string
  let otherSoundId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'sound-editor-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98521,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    const item = await createReadySound(prisma, artist.channel!.id, 'Trim target')
    soundId = item.id

    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other2@example.com`,
      username: 'sound-editor-other2',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98523,
    })
    const otherItem = await createReadySound(prisma, other.channel!.id, 'Other trim target')
    otherSoundId = otherItem.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET /api/me/sound/:id/editor/source returns presigned url', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${soundId}/editor/source`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { url: string; title: string; sourceKey: string }
    expect(body.url).toMatch(/^https?:\/\//)
    expect(body.title).toBe('Trim target')
    expect(body.sourceKey).toBeTruthy()
  })

  it('GET /api/me/sound/:id/editor/stream returns audio with CORP header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${soundId}/editor/stream`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin')
    expect(res.headers['content-type']).toMatch(/audio\/flac/)
    expect(res.body).toBe('fake-audio')
  })

  it('GET /api/me/sound/:id/editor/draft enqueues editorPeaks backfill when missing', async () => {
    const { enqueueBackfillEditorPeaks } = await import('../../lib/queue.js')
    vi.mocked(enqueueBackfillEditorPeaks).mockClear()

    const res = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${soundId}/editor/draft`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(enqueueBackfillEditorPeaks).toHaveBeenCalledWith(soundId)
  })

  it('POST /api/me/sound/:id/editor/render returns 429 when two jobs are already active', async () => {
    const artist = await prisma.user.findFirst({
      where: { email: `${PREFIX}artist@example.com` },
      include: { channel: true },
    })
    const item2 = await createReadySound(prisma, artist!.channel!.id, 'Concurrent render')

    const v1Num = (await prisma.soundVersion.count({ where: { soundId } })) + 100
    const v2Num = (await prisma.soundVersion.count({ where: { soundId: item2.id } })) + 100

    await prisma.soundVersion.createMany({
      data: [
        {
          soundId,
          versionNumber: v1Num,
          versionLabel: `${PREFIX}pending-1`,
          rawKey: 'pending/test/1',
          fileSizeBytes: 0,
          status: 'PENDING',
          isActive: false,
        },
        {
          soundId: item2.id,
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
        url: `/api/me/sound/${soundId}/editor/draft`,
        headers: { cookie },
      })
      const { editList } = draftRes.json() as { editList: Record<string, unknown> }

      const res = await app.inject({
        method: 'POST',
        url: `/api/me/sound/${soundId}/editor/render`,
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
      await prisma.soundVersion.deleteMany({
        where: { versionLabel: { startsWith: `${PREFIX}pending` } },
      })
    }
  })

  it('POST /api/me/sound/:id/editor/bounce returns 410 Gone', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/editor/bounce`,
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

  it('POST /api/me/sound/:id/editor/render enqueues worker job', async () => {
    const { enqueueRenderSoundEdit } = await import('../../lib/queue.js')
    vi.mocked(enqueueRenderSoundEdit).mockClear()

    const draftRes = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${soundId}/editor/draft`,
      headers: { cookie },
    })
    const { editList } = draftRes.json() as { editList: Record<string, unknown> }

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/editor/render`,
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
    expect(enqueueRenderSoundEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        soundId,
        format: 'flac',
        activate: false,
      }),
    )
  })

  it('POST /api/me/sound/:id/editor/render passes preview sample options to worker', async () => {
    const { enqueueRenderSoundEdit } = await import('../../lib/queue.js')
    vi.mocked(enqueueRenderSoundEdit).mockClear()

    const draftRes = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${soundId}/editor/draft`,
      headers: { cookie },
    })
    const { editList } = draftRes.json() as { editList: Record<string, unknown> }

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/editor/render`,
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
    expect(enqueueRenderSoundEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'mp3',
        sampleOnly: true,
        maxDurationSec: 30,
        activate: false,
      }),
    )
  })

  it('POST /api/me/sound/:id/editor/render rejects invalid editList', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/editor/render`,
      headers: { cookie },
      payload: {
        editList: { version: 1, sourceDuration: 120, cuts: [{ start: 0, end: 120 }] },
        versionLabel: 'Bad edit',
        format: 'flac',
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/me/sound/:id/editor/source rejects an sound item owned by another user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${otherSoundId}/editor/source`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('POST /api/me/sound/:id/editor/bounce rejects an sound item owned by another user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${otherSoundId}/editor/bounce`,
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

  it('POST /api/me/sound/:id/editor/bounce rejects an endSec that overflows to Infinity', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/editor/bounce`,
      headers: { cookie, 'content-type': 'application/json' },
      payload: '{"startSec":0,"endSec":1e400,"versionLabel":"Overflow attempt","activate":true}',
    })
    expect(res.statusCode).toBe(410)
  })

  it('POST /api/me/sound/:id/editor/publish-to-release creates a release track', async () => {
    const { mediaQueue } = await import('../../lib/queue.js')
    const artist = await prisma.user.findFirst({
      where: { email: `${PREFIX}artist@example.com` },
    })
    const release = await createPublishedReleaseWithTrack(prisma, artist!.id, {
      smartLinkSlug: `${PREFIX}publish`,
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/editor/publish-to-release`,
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
    expect(track?.soundId).toBe(soundId)
    expect(track?.title).toBe('Trim target')
  })

  it('POST /api/me/sound/:id/editor/publish-to-release rejects releases not owned by the user', async () => {
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'sound-editor-other',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98522,
    })
    const otherRelease = await createPublishedReleaseWithTrack(prisma, other.id, {
      smartLinkSlug: `${PREFIX}other-release`,
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/editor/publish-to-release`,
      headers: { cookie },
      payload: { releaseId: otherRelease.id },
    })
    expect(res.statusCode).toBe(404)
  })

  it('POST /api/me/sound/:id/editor/publish-to-release rejects versionId from another sound', async () => {
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other3@example.com`,
      username: 'sound-editor-other3',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98524,
    })
    const otherItem = await createReadySound(prisma, other.channel!.id, 'Other version source')
    await prisma.soundVersion.create({
      data: {
        soundId: otherItem.id,
        versionNumber: 2,
        versionLabel: `${PREFIX}foreign-version`,
        rawKey: 'raw/other/foreign.wav',
        fileSizeBytes: 1000,
        status: 'READY',
        isActive: false,
      },
    })
    const foreignVersion = await prisma.soundVersion.findFirst({
      where: { soundId: otherItem.id, versionNumber: 2 },
    })

    const artist = await prisma.user.findFirst({
      where: { email: `${PREFIX}artist@example.com` },
    })
    const release = await createPublishedReleaseWithTrack(prisma, artist!.id, {
      smartLinkSlug: `${PREFIX}publish-version-guard`,
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/editor/publish-to-release`,
      headers: { cookie },
      payload: { releaseId: release.id, versionId: foreignVersion!.id },
    })
    expect(res.statusCode).toBe(404)
  })

  it('PATCH /api/me/sound/:id/editor/draft rejects oversized editList payload', async () => {
    const draftRes = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${soundId}/editor/draft`,
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
      url: `/api/me/sound/${soundId}/editor/draft`,
      headers: { cookie },
      payload: huge,
    })
    expect(res.statusCode).toBe(400)
  })

  it('PATCH /api/me/sound/:id/editor/draft returns 409 on stale expectedUpdatedAt', async () => {
    const draftRes = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${soundId}/editor/draft`,
      headers: { cookie },
    })
    const { editList, updatedAt } = draftRes.json() as {
      editList: Record<string, unknown>
      updatedAt: string
    }

    await app.inject({
      method: 'PATCH',
      url: `/api/me/sound/${soundId}/editor/draft`,
      headers: { cookie },
      payload: { editList, expectedUpdatedAt: updatedAt },
    })

    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/me/sound/${soundId}/editor/draft`,
      headers: { cookie },
      payload: { editList, expectedUpdatedAt: updatedAt },
    })
    expect(stale.statusCode).toBe(409)
    expect(stale.json()).toMatchObject({ error: expect.stringContaining('elsewhere') })
  })

  it('POST /api/me/sound/:id/editor/create-clip enqueues announcement trim', async () => {
    const { enqueueRenderAnnouncementTrim } = await import('../../lib/queue.js')
    vi.mocked(enqueueRenderAnnouncementTrim).mockClear()

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/editor/create-clip`,
      headers: { cookie },
      payload: {
        startSec: 12,
        endSec: 42,
        title: 'Radio sting',
      },
    })
    expect(res.statusCode).toBe(202)
    const body = res.json() as {
      clipId: string
      title: string
      durationSec: number
      renderStatus: string
    }
    expect(body.clipId).toBeTruthy()
    expect(body.title).toBe('Radio sting')
    expect(body.durationSec).toBe(30)
    expect(body.renderStatus).toBe('PROCESSING')
    expect(enqueueRenderAnnouncementTrim).toHaveBeenCalledWith(
      expect.objectContaining({
        clipId: body.clipId,
        startSec: 12,
        endSec: 42,
      }),
    )

    const clip = await prisma.announcementClip.findUnique({ where: { id: body.clipId } })
    expect(clip?.isEnabled).toBe(false)
    expect(clip?.renderStatus).toBe('PROCESSING')
  })

  it('POST /api/me/sound/:id/editor/create-clip rejects clips longer than 60s', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/editor/create-clip`,
      headers: { cookie },
      payload: { startSec: 0, endSec: 61 },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ error: expect.stringContaining('60') })
  })
})
