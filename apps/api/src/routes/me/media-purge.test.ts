// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const store = vi.hoisted(() => ({
  listUserMediaObjects: vi.fn(),
  userMediaObjectExists: vi.fn(),
  deleteUserMediaObject: vi.fn(),
}))
vi.mock('../../lib/user-media-store.js', () => store)

const PREFIX = 'me-media-purge-'
const USERNAME = 'me-media-purge-artist'
const key = (name: string) => `media/${USERNAME}/${name}`
const object = (name: string, sizeBytes: number) => ({
  key: key(name),
  sizeBytes,
  lastModified: new Date('2026-11-01T00:00:00Z'),
})

describe('purging unused media uploads', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let otherCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: USERNAME,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    await prisma.user.update({
      where: { id: artist.id },
      data: { avatarUrl: `https://cdn.example/${key('avatar-k1.png')}` },
    })
    await prisma.channel.update({
      where: { userId: artist.id },
      data: {
        visualSettingsJson: JSON.stringify({ slides: [`/${key('slide-k2.webp')}`] }),
      },
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'me-media-purge-other',
    })
    otherCookie = await sessionCookieFor(prisma, other.id)
    await prisma.user.update({
      where: { id: other.id },
      data: { avatarUrl: `https://cdn.example/${key('orphan-k3.png')}` },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const listing = () => [
    object('avatar-k1.png', 100),
    object('slide-k2.webp', 200),
    object('orphan-k3.png', 300),
    object('old-k4.jpg', 400),
  ]

  it('lists only uploads nothing of yours points at', async () => {
    store.listUserMediaObjects.mockResolvedValueOnce(listing())
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/media/unused',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      count: 2,
      totalBytes: 700,
      ids: [key('orphan-k3.png'), key('old-k4.jpg')],
    })
    expect(store.deleteUserMediaObject).not.toHaveBeenCalled()
  })

  it('deletes the unused uploads and keeps the ones in use', async () => {
    store.listUserMediaObjects.mockResolvedValueOnce(listing())
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/media/purge-unused',
      headers: { cookie },
    })
    expect(res.json()).toEqual({ deleted: 2, freedBytes: 700 })
    expect(store.deleteUserMediaObject.mock.calls.map((c) => c[0]).sort()).toEqual(
      [key('old-k4.jpg'), key('orphan-k3.png')].sort(),
    )
  })

  it("only ever lists the caller's own prefix", async () => {
    store.listUserMediaObjects.mockResolvedValueOnce([])
    await app.inject({
      method: 'GET',
      url: '/api/me/media/unused',
      headers: { cookie: otherCookie },
    })
    expect(store.listUserMediaObjects).toHaveBeenCalledWith('media/me-media-purge-other/')
  })
})
