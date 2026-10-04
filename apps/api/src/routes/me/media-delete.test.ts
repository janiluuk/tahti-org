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

const PREFIX = 'me-media-delete-'
const OWN_KEY = 'media/me-media-delete-artist/abc.png'

describe('DELETE /api/me/media/:id', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'me-media-delete-artist',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const del = (key: string) =>
    app.inject({
      method: 'DELETE',
      url: `/api/me/media/${encodeURIComponent(key)}`,
      headers: { cookie },
    })

  it('deletes one of your uploads by its URL-encoded key', async () => {
    store.userMediaObjectExists.mockResolvedValueOnce(true)
    const res = await del(OWN_KEY)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    expect(store.deleteUserMediaObject).toHaveBeenCalledWith(OWN_KEY)
  })

  it("refuses someone else's key or a path escape", async () => {
    for (const key of [
      'media/someone-else/abc.png',
      'media/me-media-delete-artist/../someone-else/abc.png',
      'releases/me-media-delete-artist/x.png',
    ]) {
      const res = await del(key)
      expect(res.statusCode).toBe(403)
    }
    expect(store.deleteUserMediaObject).not.toHaveBeenCalled()
  })

  it('404s a key that is already gone', async () => {
    store.userMediaObjectExists.mockResolvedValueOnce(false)
    const res = await del(OWN_KEY)
    expect(res.statusCode).toBe(404)
    expect(store.deleteUserMediaObject).not.toHaveBeenCalled()
  })
})
