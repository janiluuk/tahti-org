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

const { listUserMediaObjects } = vi.hoisted(() => ({ listUserMediaObjects: vi.fn() }))
vi.mock('../../lib/user-media-store.js', () => ({
  listUserMediaObjects,
  userMediaObjectExists: vi.fn(),
  deleteUserMediaObject: vi.fn(),
}))

const PREFIX = 'me-media-list-'

describe('GET /api/me/media', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'me-media-list-artist',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('needs a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/media' })
    expect(res.statusCode).toBe(401)
  })

  it("lists the caller's uploads newest first from their storage prefix", async () => {
    listUserMediaObjects.mockResolvedValueOnce([
      {
        key: 'media/me-media-list-artist/old.png',
        sizeBytes: 10,
        lastModified: new Date('2026-09-01T00:00:00.000Z'),
      },
      {
        key: 'media/me-media-list-artist/new.webp',
        sizeBytes: 20,
        lastModified: new Date('2026-09-20T00:00:00.000Z'),
      },
    ])
    const res = await app.inject({ method: 'GET', url: '/api/me/media', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    expect(listUserMediaObjects).toHaveBeenCalledWith('media/me-media-list-artist/')
    const { files } = res.json() as {
      files: Array<{
        id: string
        filename: string
        contentType: string
        sizeBytes: number
        url: string
      }>
    }
    expect(files.map((file) => file.id)).toEqual([
      'media/me-media-list-artist/new.webp',
      'media/me-media-list-artist/old.png',
    ])
    expect(files[0]).toMatchObject({
      filename: 'new.webp',
      contentType: 'image/webp',
      sizeBytes: 20,
    })
    expect(files[0]!.url).toContain('media/me-media-list-artist/new.webp')
  })
})
