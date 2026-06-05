// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadyArchiveItem,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'editor-project-test-'

describe('M21 v1 — editor projects', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let archiveItemId: string
  let projectId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'editor-project-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98522,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    const item = await createReadyArchiveItem(prisma, artist.channel!.id, 'Editor seed')
    archiveItemId = item.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('POST /api/me/editor/projects seeds from archive item', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/editor/projects',
      headers: { cookie },
      payload: { archiveItemId },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { id: string; title: string; archiveItemId: string }
    projectId = body.id
    expect(body.archiveItemId).toBe(archiveItemId)
    expect(body.title).toContain('Editor seed')
  })

  it('GET /api/me/editor/projects/:id resolves audio sources', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/editor/projects/${projectId}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { sources: Array<{ url: string }> }
    expect(body.sources.length).toBeGreaterThan(0)
    expect(body.sources[0].url).toMatch(/^https?:\/\//)
  })

  it('PATCH /api/me/editor/projects/:id autosaves timeline', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/me/editor/projects/${projectId}`,
      headers: { cookie },
      payload: { timeline: { tracks: [{ id: 't1', clips: [] }] } },
    })
    expect(res.statusCode).toBe(200)
  })
})
