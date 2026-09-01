// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/minio.js', () => ({
  presignedGetUrl: vi.fn().mockResolvedValue('https://minio.test/get'),
}))

import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'admin-files-'

describe('/api/admin/files', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let artistCookie: string
  let technoId: string
  let folkId: string
  let artistUserId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      displayName: 'Files Board',
      isBoard: true,
      isMember: true,
      tier: 'STUDIO',
    })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'Files Artist',
    })
    artistCookie = await sessionCookieFor(prisma, artist.id)
    artistUserId = artist.id

    const techno = await prisma.archiveItem.create({
      data: {
        channelId: artist.channel!.id,
        title: `${PREFIX} techno track`,
        genre: 'Techno',
        contentType: 'DJ_SET',
        status: 'READY',
        isPublic: true,
        mp3Key: `${PREFIX}techno.mp3`,
        fileSizeBytes: BigInt(7_000_000),
      },
    })
    technoId = techno.id

    await prisma.archiveItemVersion.create({
      data: {
        archiveItemId: technoId,
        versionNumber: 1,
        versionLabel: 'Original upload',
        rawKey: `${PREFIX}techno-v1.wav`,
        isActive: true,
      },
    })

    const folk = await prisma.archiveItem.create({
      data: {
        channelId: artist.channel!.id,
        title: `${PREFIX} folk track`,
        genre: 'Folk',
        contentType: 'TRACK',
        status: 'READY',
        isPublic: true,
        mp3Key: `${PREFIX}folk.mp3`,
      },
    })
    folkId = folk.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('rejects non-board users', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/files',
      headers: { cookie: artistCookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('lists files and filters by genre + user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/files?userIds=${artistUserId}&genres=Techno`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      items: Array<{
        id: string
        genre: string | null
        sizeBytes: number | null
        revisionCount: number
      }>
    }
    const ids = body.items.map((i) => i.id)
    expect(ids).toContain(technoId)
    expect(ids).not.toContain(folkId)
    expect(body.items.find((i) => i.id === technoId)?.sizeBytes).toBe(7_000_000)
    expect(body.items.find((i) => i.id === technoId)?.revisionCount).toBe(1)
  })

  it('bulk-assigns content type to selected ids', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/files/bulk',
      headers: { cookie: boardCookie },
      payload: { ids: [folkId], contentType: 'PODCAST', genre: 'Podcast' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ updated: 1 })

    const row = await prisma.archiveItem.findUnique({ where: { id: folkId } })
    expect(row?.contentType).toBe('PODCAST')
    expect(row?.genre).toBe('Podcast')
  })

  it('returns a presigned audio url for preview', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/files/${technoId}/audio`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ audioUrl: 'https://minio.test/get' })
  })

  it('deletes an archive file', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/files/${folkId}`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(204)
    expect(await prisma.archiveItem.findUnique({ where: { id: folkId } })).toBeNull()
  })
})
