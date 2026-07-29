// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'
import { recordUsageDelta } from '../../lib/storage-quota.js'

const PREFIX = 'admin-storage-test-'

describe('GET /api/admin/storage', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('requires board auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/storage' })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a non-board user', async () => {
    const nonBoard = await createTestArtist(prisma, {
      email: `${PREFIX}non-board@example.com`,
      username: `${PREFIX}non-board`,
    })
    const cookie = await sessionCookieFor(prisma, nonBoard.id)
    const res = await app.inject({ method: 'GET', url: '/api/admin/storage', headers: { cookie } })
    expect(res.statusCode).toBe(403)
  })

  it('reports overall usage and a per-user breakdown', async () => {
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
    })
    const cookie = await sessionCookieFor(prisma, board.id)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    await recordUsageDelta(prisma, artist.id, 12_345)

    const res = await app.inject({ method: 'GET', url: '/api/admin/storage', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const row = body.users.find((u: { userId: string }) => u.userId === artist.id)
    expect(row).toBeDefined()
    expect(row.usedBytes).toBe(12_345)
    expect(body.totalUsedBytes).toBeGreaterThanOrEqual(12_345)
  })
})

describe('GET /api/admin/storage/users/:id/files', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let artistId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}files-board@example.com`,
      username: `${PREFIX}files-board`,
      isBoard: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}files-artist@example.com`,
      username: `${PREFIX}files-artist`,
    })
    artistId = artist.id

    const release = await prisma.release.create({
      data: {
        userId: artistId,
        title: 'Files Test Single',
        type: 'SINGLE',
        releaseDate: new Date(),
        smartLinkSlug: `${PREFIX}files-single`,
      },
    })
    await prisma.releaseTrack.create({
      data: {
        releaseId: release.id,
        position: 0,
        title: 'Files Test Track',
        streamKey: `releases/${artistId}/${release.id}/track-1/stream.ogg`,
        r2Key: `releases/${artistId}/${release.id}/track-1/original.wav`,
        r2SizeBytes: 999,
        durationSec: 120,
      },
    })
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('requires board auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/storage/users/${artistId}/files`,
    })
    expect(res.statusCode).toBe(401)
  })

  it("lists a user's release tracks with R2 status and a preview URL", async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/storage/users/${artistId}/files`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.files).toHaveLength(1)
    expect(body.files[0].title).toBe('Files Test Track')
    expect(body.files[0].inR2).toBe(true)
    expect(body.files[0].sizeBytes).toBe(999)
    expect(body.files[0].previewUrl).toContain('stream.ogg')
  })

  it('404s for an unknown user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/storage/users/does-not-exist/files',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(404)
  })
})
