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

const PREFIX = 'archive-stems-test-'

vi.mock('../../lib/queue.js', () => ({
  enqueueSeparateStems: vi.fn().mockResolvedValue(undefined),
  mediaQueue: { add: vi.fn() },
}))

const { enqueueSeparateStems } = await import('../../lib/queue.js')

describe('archive stems + download', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let itemId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
    })
    cookie = await sessionCookieFor(prisma, owner.id)
    const item = await createReadyArchiveItem(prisma, owner.channel!.id, 'Stems Test Track')
    itemId = item.id
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  describe('GET /api/me/archive/:id/download', () => {
    it('requires auth', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/me/archive/${itemId}/download` })
      expect(res.statusCode).toBe(401)
    })

    it('returns a presigned URL for the best available source', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/me/archive/${itemId}/download`,
        headers: { cookie },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.url).toBeDefined()
      expect(body.filename).toContain('Stems Test Track')
    })

    it("404s for another user's track", async () => {
      const other = await createTestArtist(prisma, {
        email: `${PREFIX}other@example.com`,
        username: `${PREFIX}other`,
      })
      const otherCookie = await sessionCookieFor(prisma, other.id)
      const res = await app.inject({
        method: 'GET',
        url: `/api/me/archive/${itemId}/download`,
        headers: { cookie: otherCookie },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('POST /api/me/archive/:id/stems/render + GET /api/me/archive/:id/stems', () => {
    it('requires auth to request stems', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/me/archive/${itemId}/stems/render`,
        payload: { stemSet: 'TWO_STEM' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('enqueues a stem job and reports PENDING status', async () => {
      const renderRes = await app.inject({
        method: 'POST',
        url: `/api/me/archive/${itemId}/stems/render`,
        headers: { cookie },
        payload: { stemSet: 'TWO_STEM' },
      })
      expect(renderRes.statusCode).toBe(202)
      expect(renderRes.json().status).toBe('PENDING')
      expect(enqueueSeparateStems).toHaveBeenCalledWith(
        expect.objectContaining({ archiveItemId: itemId, stemSet: 'TWO_STEM' }),
      )

      const statusRes = await app.inject({
        method: 'GET',
        url: `/api/me/archive/${itemId}/stems`,
        headers: { cookie },
      })
      expect(statusRes.statusCode).toBe(200)
      const body = statusRes.json()
      expect(body.jobs).toHaveLength(1)
      expect(body.jobs[0].stemSet).toBe('TWO_STEM')
      expect(body.jobs[0].status).toBe('PENDING')
      expect(body.jobs[0].files).toHaveLength(0)
    })

    it('does not re-enqueue while a job is already PENDING/PROCESSING', async () => {
      vi.mocked(enqueueSeparateStems).mockClear()
      const res = await app.inject({
        method: 'POST',
        url: `/api/me/archive/${itemId}/stems/render`,
        headers: { cookie },
        payload: { stemSet: 'TWO_STEM' },
      })
      expect(res.statusCode).toBe(202)
      expect(enqueueSeparateStems).not.toHaveBeenCalled()
    })

    it('lists presigned URLs for a READY job', async () => {
      await prisma.archiveItemStemJob.updateMany({
        where: { archiveItemId: itemId, stemSet: 'TWO_STEM' },
        data: {
          status: 'READY',
          vocalsKey: `stems/x/${itemId}/vocals.flac`,
          instrumentalKey: `stems/x/${itemId}/instrumental.flac`,
        },
      })

      const res = await app.inject({
        method: 'GET',
        url: `/api/me/archive/${itemId}/stems`,
        headers: { cookie },
      })
      expect(res.statusCode).toBe(200)
      const job = res.json().jobs[0]
      expect(job.status).toBe('READY')
      expect(job.files).toHaveLength(2)
      expect(job.files.map((f: { label: string }) => f.label).sort()).toEqual([
        'Instrumental',
        'Vocals',
      ])
    })
  })
})
