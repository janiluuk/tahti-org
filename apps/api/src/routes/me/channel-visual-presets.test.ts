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

const PREFIX = 'channel-visual-presets-route-'

describe('channel visual preset routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'channel-visual-presets-route-user',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98546,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
    vi.unstubAllGlobals()
  })

  it('GET starts empty', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/channel/visual-presets',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('POST saves a named preset and GET lists it back', async () => {
    const saveRes = await app.inject({
      method: 'POST',
      url: '/api/me/channel/visual-presets',
      headers: { cookie },
      payload: {
        name: 'Neon night',
        settings: { visualPreset: 'AURORA', headerStyle: 'GRADIENT' },
      },
    })
    expect(saveRes.statusCode).toBe(200)
    const saved = saveRes.json() as { id: string; name: string; settings: Record<string, unknown> }
    expect(saved.name).toBe('Neon night')
    expect(saved.settings).toEqual({ visualPreset: 'AURORA', headerStyle: 'GRADIENT' })

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/me/channel/visual-presets',
      headers: { cookie },
    })
    expect(listRes.statusCode).toBe(200)
    const list = listRes.json() as Array<{ id: string; name: string }>
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe(saved.id)
  })

  it('POST with the same name overwrites the existing preset instead of duplicating it', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/me/channel/visual-presets',
      headers: { cookie },
      payload: { name: 'Overwrite me', settings: { headerStyle: 'GRADIENT' } },
    })
    const secondSave = await app.inject({
      method: 'POST',
      url: '/api/me/channel/visual-presets',
      headers: { cookie },
      payload: { name: 'Overwrite me', settings: { headerStyle: 'SOLID' } },
    })
    expect(secondSave.statusCode).toBe(200)

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/me/channel/visual-presets',
      headers: { cookie },
    })
    const list = listRes.json() as Array<{ name: string; settings: Record<string, unknown> }>
    const matches = list.filter((p) => p.name === 'Overwrite me')
    expect(matches).toHaveLength(1)
    expect(matches[0]?.settings).toEqual({ headerStyle: 'SOLID' })
  })

  it('rejects an empty name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/visual-presets',
      headers: { cookie },
      payload: { name: '  ', settings: {} },
    })
    expect(res.statusCode).toBe(400)
  })

  it('DELETE removes a preset owned by the caller', async () => {
    const saveRes = await app.inject({
      method: 'POST',
      url: '/api/me/channel/visual-presets',
      headers: { cookie },
      payload: { name: 'Temporary', settings: {} },
    })
    const { id } = saveRes.json() as { id: string }

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/me/channel/visual-presets/${id}`,
      headers: { cookie },
    })
    expect(deleteRes.statusCode).toBe(200)

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/me/channel/visual-presets',
      headers: { cookie },
    })
    const list = listRes.json() as Array<{ id: string }>
    expect(list.find((p) => p.id === id)).toBeUndefined()
  })

  it('DELETE 404s for a preset that does not belong to the caller', async () => {
    const otherArtist = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'channel-visual-presets-route-other',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98547,
    })
    const otherCookie = await sessionCookieFor(prisma, otherArtist.id)
    const saveRes = await app.inject({
      method: 'POST',
      url: '/api/me/channel/visual-presets',
      headers: { cookie: otherCookie },
      payload: { name: 'Not yours', settings: {} },
    })
    const { id } = saveRes.json() as { id: string }

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/me/channel/visual-presets/${id}`,
      headers: { cookie },
    })
    expect(deleteRes.statusCode).toBe(404)
  })
})
