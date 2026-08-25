// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createReadyArchiveItem,
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

  it('reports overall usage and a per-user breakdown, with disk + object storage readings', async () => {
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

    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: `${PREFIX}member`,
      tier: 'ARTIST',
      isMember: true,
    })
    await recordUsageDelta(prisma, member.id, 999)

    const res = await app.inject({ method: 'GET', url: '/api/admin/storage', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const row = body.users.find((u: { userId: string }) => u.userId === artist.id)
    expect(row).toBeDefined()
    expect(row.usedBytes).toBe(12_345)
    expect(row.unlimited).toBe(false)
    expect(body.totalUsedBytes).toBeGreaterThanOrEqual(12_345)

    const memberRow = body.users.find((u: { userId: string }) => u.userId === member.id)
    expect(memberRow.unlimited).toBe(true)

    expect(body.objectStorage.usedBytes).toBe(body.totalUsedBytes)
    expect(body.objectStorage.totalBytes).toBeNull()
    // Local disk is a real statfs() reading in the test environment, not a fixture.
    expect(typeof body.localDisk.usedBytes === 'number' || body.localDisk.usedBytes === null).toBe(
      true,
    )
  })
})

describe('GET /api/admin/storage/users/:id/files (merged archive + stash)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let artistId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}merged-board@example.com`,
      username: `${PREFIX}merged-board`,
      isBoard: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}merged-artist@example.com`,
      username: `${PREFIX}merged-artist`,
      tier: 'STUDIO',
    })
    artistId = artist.id

    await createReadyArchiveItem(prisma, artist.channel!.id, 'Merged Test Track')
    await prisma.stashFile.create({
      data: {
        userId: artistId,
        filename: 'cover-art.png',
        objectKey: `stash/${artistId}/cover-art.png`,
        contentType: 'image/png',
        sizeBytes: BigInt(2_000_000),
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

  it('merges archive items and stash files, oldest first, with a running total', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/storage/users/${artistId}/files`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.tier).toBe('STUDIO')
    expect(body.unlimited).toBe(false)
    expect(body.files).toHaveLength(2)

    const [first, second] = body.files
    expect(first.title).toBe('Merged Test Track')
    expect(first.kind).toBe('archive')
    expect(first.isAudio).toBe(true)
    expect(first.runningTotalBytes).toBe(5_000_000)

    expect(second.title).toBe('cover-art.png')
    expect(second.kind).toBe('stash')
    expect(second.isAudio).toBe(false)
    expect(second.previewUrl).toBeNull()
    expect(second.runningTotalBytes).toBe(5_000_000 + 2_000_000)
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

describe('PATCH /api/admin/storage/users/:id/quota', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let artistId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}quota-board@example.com`,
      username: `${PREFIX}quota-board`,
      isBoard: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}quota-artist@example.com`,
      username: `${PREFIX}quota-artist`,
    })
    artistId = artist.id
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('requires board auth', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/storage/users/${artistId}/quota`,
      payload: { quotaBytes: 1_000_000 },
    })
    expect(res.statusCode).toBe(401)
  })

  it('sets a quota override for a user with no existing quota row', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/storage/users/${artistId}/quota`,
      headers: { cookie: boardCookie },
      payload: { quotaBytes: 2_000_000_000 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ quotaBytes: 2_000_000_000, usedBytes: 0, unlimited: false })

    const row = await prisma.userStorageQuota.findUnique({ where: { userId: artistId } })
    expect(row?.quotaBytes).toBe(2_000_000_000n)
  })

  it('overwrites an existing quota without touching usedBytes', async () => {
    await recordUsageDelta(prisma, artistId, 500)

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/storage/users/${artistId}/quota`,
      headers: { cookie: boardCookie },
      payload: { quotaBytes: 3_000_000_000 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.quotaBytes).toBe(3_000_000_000)
    expect(body.usedBytes).toBe(500)
  })

  it('reports unlimited for a member even when a quota row exists', async () => {
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}quota-member@example.com`,
      username: `${PREFIX}quota-member`,
      tier: 'ARTIST',
      isMember: true,
    })

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/storage/users/${member.id}/quota`,
      headers: { cookie: boardCookie },
      payload: { quotaBytes: 1_000_000 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ quotaBytes: 1_000_000, usedBytes: 0, unlimited: true })
  })

  it('rejects a non-positive quota', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/storage/users/${artistId}/quota`,
      headers: { cookie: boardCookie },
      payload: { quotaBytes: 0 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('404s for an unknown user', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/storage/users/does-not-exist/quota',
      headers: { cookie: boardCookie },
      payload: { quotaBytes: 1_000_000 },
    })
    expect(res.statusCode).toBe(404)
  })
})
