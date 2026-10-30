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

const PREFIX = 'admin-artwork-preset-'
const URL = 'https://example.com/artwork-preset-test.webp'

describe('artwork preset routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let userCookie: string
  let presetId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })
    userCookie = await sessionCookieFor(prisma, user.id)
  })

  afterAll(async () => {
    await prisma.artworkPreset.deleteMany({ where: { url: URL } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('rejects non-board users', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/artwork-presets',
      headers: { cookie: userCookie },
      payload: { url: URL },
    })
    expect(res.statusCode).toBe(403)
  })

  it('creates an enabled preset that the public list offers', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/artwork-presets',
      headers: { cookie: boardCookie },
      payload: { url: URL },
    })
    expect(res.statusCode).toBe(201)
    presetId = res.json().id
    expect(res.json().enabled).toBe(true)

    const list = await app.inject({ method: 'GET', url: '/api/v1/artwork-presets' })
    expect(list.statusCode).toBe(200)
    expect(list.json().presets.map((p: { url: string }) => p.url)).toContain(URL)
  })

  it('drops a disabled preset from the public list', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/artwork-presets/${presetId}`,
      headers: { cookie: boardCookie },
      payload: { enabled: false },
    })
    expect(res.statusCode).toBe(200)

    const list = await app.inject({ method: 'GET', url: '/api/v1/artwork-presets' })
    expect(list.json().presets.map((p: { url: string }) => p.url)).not.toContain(URL)
  })

  it('saves a preset as the cover of a new collection without one', async () => {
    await app.inject({
      method: 'PATCH',
      url: `/api/admin/artwork-presets/${presetId}`,
      headers: { cookie: boardCookie },
      payload: { enabled: true },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/collections',
      headers: { cookie: userCookie },
      payload: { name: `${PREFIX}Mix` },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().coverUrl).toMatch(/^https?:\/\//)
  })

  it('deletes a preset', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/artwork-presets/${presetId}`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(204)
  })
})
