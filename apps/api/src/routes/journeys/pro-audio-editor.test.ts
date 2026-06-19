// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * E2E journey: pro audio editor — load source, autosave EditList draft, server render,
 * multitrack editor project, publish edited archive to a release track.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { editListFromV0Trim } from '@tahti/audio-edit'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createPublishedReleaseWithTrack,
  createReadyArchiveItem,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

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
    presignedGetUrl: vi.fn().mockResolvedValue('https://minio.test/editor-source'),
    getObjectStream: vi.fn().mockResolvedValue({
      body: Buffer.from('fake-audio'),
      contentType: 'audio/flac',
      contentLength: 10,
    }),
  }
})

const PREFIX = 'journey-editor-'

describe('Pro audio editor journey', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistCookie: string
  let archiveItemId: string
  let projectId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'journey-pro-editor',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98130,
    })
    artistCookie = await sessionCookieFor(prisma, artist.id)

    const item = await createReadyArchiveItem(prisma, artist.channel!.id, 'Live set for edit')
    archiveItemId = item.id
    await prisma.archiveItem.update({
      where: { id: archiveItemId },
      data: { durationSec: 3600 },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('loads source, saves trim draft, renders, opens multitrack project, and publishes to release', async () => {
    const source = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/editor/source`,
      headers: { cookie: artistCookie },
    })
    expect(source.statusCode).toBe(200)
    expect(source.json().sourceKey).toBeTruthy()

    const stream = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/editor/stream`,
      headers: { cookie: artistCookie },
    })
    expect(stream.statusCode).toBe(200)
    expect(stream.headers['cross-origin-resource-policy']).toBe('cross-origin')

    const draftLoad = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/editor/draft`,
      headers: { cookie: artistCookie },
    })
    expect(draftLoad.statusCode).toBe(200)
    const { updatedAt } = draftLoad.json() as { updatedAt: string }

    const trimmed = editListFromV0Trim({
      sourceDuration: 3600,
      startSec: 90,
      endSec: 3510,
      fadeInSec: 2,
      fadeOutSec: 4,
      peakNormalize: false,
      lufsTarget: 'stream',
      limiterEnabled: true,
      highPassHz: 80,
      lowPassHz: 0,
      eq: { lowGainDb: 1.5, midGainDb: 0, highGainDb: -0.5 },
      compressorEnabled: true,
    })

    const saveDraft = await app.inject({
      method: 'PATCH',
      url: `/api/me/archive/${archiveItemId}/editor/draft`,
      headers: { cookie: artistCookie },
      payload: { editList: trimmed, expectedUpdatedAt: updatedAt },
    })
    expect(saveDraft.statusCode).toBe(200)

    const draftReload = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/editor/draft`,
      headers: { cookie: artistCookie },
    })
    expect(draftReload.statusCode).toBe(200)
    const reloaded = draftReload.json() as {
      editList: { cuts: unknown[]; loudnorm: { enabled: boolean } }
    }
    expect(reloaded.editList.cuts.length).toBeGreaterThan(0)
    expect(reloaded.editList.loudnorm.enabled).toBe(true)

    const { enqueueRenderArchiveEdit } = await import('../../lib/queue.js')
    vi.mocked(enqueueRenderArchiveEdit).mockClear()

    const render = await app.inject({
      method: 'POST',
      url: `/api/me/archive/${archiveItemId}/editor/render`,
      headers: { cookie: artistCookie },
      payload: {
        editList: reloaded.editList,
        versionLabel: 'E2E trimmed master',
        activate: true,
        format: 'flac',
      },
    })
    expect(render.statusCode).toBe(202)
    expect(enqueueRenderArchiveEdit).toHaveBeenCalledWith(
      expect.objectContaining({ archiveItemId, format: 'flac', activate: true }),
    )

    const bounceRemoved = await app.inject({
      method: 'POST',
      url: `/api/me/archive/${archiveItemId}/editor/bounce`,
      headers: { cookie: artistCookie },
      payload: { startSec: 0, endSec: 60, versionLabel: 'Legacy', activate: true },
    })
    expect(bounceRemoved.statusCode).toBe(410)

    const projectCreate = await app.inject({
      method: 'POST',
      url: '/api/me/editor/projects',
      headers: { cookie: artistCookie },
      payload: { archiveItemId },
    })
    expect(projectCreate.statusCode).toBe(201)
    projectId = projectCreate.json().id as string

    const projectLoad = await app.inject({
      method: 'GET',
      url: `/api/me/editor/projects/${projectId}`,
      headers: { cookie: artistCookie },
    })
    expect(projectLoad.statusCode).toBe(200)
    const detail = projectLoad.json() as { sources: Array<{ archiveItemId: string; url: string }> }
    expect(detail.sources.some((s) => s.archiveItemId === archiveItemId)).toBe(true)

    const autosave = await app.inject({
      method: 'PATCH',
      url: `/api/me/editor/projects/${projectId}`,
      headers: { cookie: artistCookie },
      payload: {
        timeline: {
          tracks: [{ id: 'main', clips: [{ archiveItemId, startSec: 0, durationSec: 3600 }] }],
          seedArchiveItemId: archiveItemId,
        },
      },
    })
    expect(autosave.statusCode).toBe(200)

    const artist = await prisma.user.findFirst({ where: { email: `${PREFIX}artist@example.com` } })
    const release = await createPublishedReleaseWithTrack(prisma, artist!.id, {
      smartLinkSlug: `${PREFIX}from-editor`,
    })

    const { mediaQueue } = await import('../../lib/queue.js')
    vi.mocked(mediaQueue.add).mockClear()

    const publish = await app.inject({
      method: 'POST',
      url: `/api/me/archive/${archiveItemId}/editor/publish-to-release`,
      headers: { cookie: artistCookie },
      payload: { releaseId: release.id, title: 'Edited live cut' },
    })
    expect(publish.statusCode).toBe(201)
    expect(mediaQueue.add).toHaveBeenCalledWith('transcode-release-track', {
      trackId: publish.json().trackId,
    })

    const audit = await prisma.auditLog.findMany({
      where: {
        actorId: artist!.id,
        action: { in: ['ARCHIVE_EDIT_RENDER', 'ARCHIVE_EDIT_PUBLISH'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })
    expect(audit.some((row) => row.action === 'ARCHIVE_EDIT_RENDER')).toBe(true)
    expect(audit.some((row) => row.action === 'ARCHIVE_EDIT_PUBLISH')).toBe(true)
  })
})
