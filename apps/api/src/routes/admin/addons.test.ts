// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'admin-addons-test-'

describe('admin addons — metadata edit and delete', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let addonId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-addons-test-board',
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)
  })

  afterAll(async () => {
    await prisma.addon.deleteMany({ where: { slug: { startsWith: 'admin-addons-test-' } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('registers a widget (setup for the tests below)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/addons',
      headers: { cookie: boardCookie },
      payload: {
        slug: 'admin-addons-test-widget',
        scope: 'LISTENER',
        name: 'Test widget',
        description: 'A widget registered for admin addons tests',
        authorName: 'Tahti',
        categories: ['other'],
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.status).toBe('DRAFT')
    expect(body.enabledByDefault).toBe(false)
    expect(body.defaultConfigJson).toBeNull()
    addonId = body.id
  })

  it('lists it back under GET /api/admin/addons as { widgets }', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/addons',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { widgets: Array<{ id: string }> }
    expect(body.widgets.some((w) => w.id === addonId)).toBe(true)
  })

  it('sets enabled-by-default and default config', async () => {
    const enabled = await app.inject({
      method: 'POST',
      url: `/api/admin/addons/${addonId}/enabled-by-default`,
      headers: { cookie: boardCookie },
      payload: { enabledByDefault: true },
    })
    expect(enabled.statusCode).toBe(200)
    expect(enabled.json().enabledByDefault).toBe(true)

    const config = await app.inject({
      method: 'POST',
      url: `/api/admin/addons/${addonId}/default-config`,
      headers: { cookie: boardCookie },
      payload: { defaultConfigJson: { showFollowers: true } },
    })
    expect(config.statusCode).toBe(200)
    expect(config.json().defaultConfigJson).toEqual({ showFollowers: true })

    const cleared = await app.inject({
      method: 'POST',
      url: `/api/admin/addons/${addonId}/default-config`,
      headers: { cookie: boardCookie },
      payload: { defaultConfigJson: null },
    })
    expect(cleared.statusCode).toBe(200)
    expect(cleared.json().defaultConfigJson).toBeNull()
  })

  it('PATCH edits metadata but leaves slug/scope/status untouched', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/addons/${addonId}`,
      headers: { cookie: boardCookie },
      payload: {
        name: 'Renamed widget',
        description: 'Updated description',
        authorName: 'Tahti Team',
        categories: ['social', 'stats'],
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({
      id: addonId,
      slug: 'admin-addons-test-widget',
      scope: 'LISTENER',
      status: 'DRAFT',
      name: 'Renamed widget',
      description: 'Updated description',
      authorName: 'Tahti Team',
      categories: ['social', 'stats'],
    })
  })

  it('PATCH 400s on an empty categories array', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/addons/${addonId}`,
      headers: { cookie: boardCookie },
      payload: {
        name: 'Renamed widget',
        description: 'Updated description',
        authorName: 'Tahti Team',
        categories: [],
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('PATCH 404s for a nonexistent widget', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/addons/does-not-exist',
      headers: { cookie: boardCookie },
      payload: {
        name: 'X',
        description: 'Y',
        authorName: 'Z',
        categories: ['other'],
      },
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE removes the widget for good', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/addons/${addonId}`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(204)

    const gone = await prisma.addon.findUnique({ where: { id: addonId } })
    expect(gone).toBeNull()
  })

  it('DELETE 404s for a widget that no longer exists', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/addons/${addonId}`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(404)
  })
})
