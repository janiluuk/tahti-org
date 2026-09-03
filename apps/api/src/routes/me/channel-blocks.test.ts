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

const PREFIX = 'channel-blocks-'

describe('me/channel/blocks', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let otherCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    cookie = await sessionCookieFor(prisma, artist.id)

    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    otherCookie = await sessionCookieFor(prisma, other.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/channel/blocks' })
    expect(res.statusCode).toBe(401)
  })

  it('GET starts empty for a fresh channel', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/channel/blocks',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ blocks: [] })
  })

  it('POST creates a block and assigns an appended position', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/me/channel/blocks',
      headers: { cookie },
      payload: {
        type: 'LOGO',
        width: 'HALF',
        configJson: { assetUrl: 'https://example.com/a.png' },
      },
    })
    expect(first.statusCode).toBe(201)
    const firstBody = first.json() as { id: string; position: number; width: string }
    expect(firstBody.position).toBe(0)
    expect(firstBody.width).toBe('HALF')

    const second = await app.inject({
      method: 'POST',
      url: '/api/me/channel/blocks',
      headers: { cookie },
      payload: { type: 'ADDON', configJson: { addonInstallId: 'abc' } },
    })
    expect(second.statusCode).toBe(201)
    const secondBody = second.json() as { position: number; width: string }
    expect(secondBody.position).toBe(1)
    expect(secondBody.width).toBe('FULL') // default

    const list = await app.inject({
      method: 'GET',
      url: '/api/me/channel/blocks',
      headers: { cookie },
    })
    const listBody = list.json() as { blocks: Array<{ id: string; position: number }> }
    expect(listBody.blocks.map((b) => b.position)).toEqual([0, 1])
  })

  it('POST rejects an invalid type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/blocks',
      headers: { cookie },
      payload: { type: 'BANNER' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('PATCH updates width, position, and configJson', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/me/channel/blocks',
      headers: { cookie },
      payload: { type: 'LOGO', width: 'FULL' },
    })
    const { id } = created.json() as { id: string }

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/me/channel/blocks/${id}`,
      headers: { cookie },
      payload: {
        width: 'THIRD',
        position: 5,
        configJson: { assetUrl: 'https://example.com/b.png' },
      },
    })
    expect(patched.statusCode).toBe(200)
    const body = patched.json() as {
      width: string
      position: number
      configJson: Record<string, unknown>
    }
    expect(body.width).toBe('THIRD')
    expect(body.position).toBe(5)
    expect(body.configJson).toEqual({ assetUrl: 'https://example.com/b.png' })
  })

  it('PATCH rejects an empty body', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/me/channel/blocks',
      headers: { cookie },
      payload: { type: 'LOGO' },
    })
    const { id } = created.json() as { id: string }

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/me/channel/blocks/${id}`,
      headers: { cookie },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it("PATCH 404s on another artist's block", async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/me/channel/blocks',
      headers: { cookie },
      payload: { type: 'LOGO' },
    })
    const { id } = created.json() as { id: string }

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/me/channel/blocks/${id}`,
      headers: { cookie: otherCookie },
      payload: { width: 'HALF' },
    })
    expect(res.statusCode).toBe(404)
  })

  it("DELETE 404s on another artist's block, then succeeds for the owner", async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/me/channel/blocks',
      headers: { cookie },
      payload: { type: 'ADDON' },
    })
    const { id } = created.json() as { id: string }

    const wrongOwner = await app.inject({
      method: 'DELETE',
      url: `/api/me/channel/blocks/${id}`,
      headers: { cookie: otherCookie },
    })
    expect(wrongOwner.statusCode).toBe(404)

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/me/channel/blocks/${id}`,
      headers: { cookie },
    })
    expect(deleted.statusCode).toBe(204)

    const again = await app.inject({
      method: 'DELETE',
      url: `/api/me/channel/blocks/${id}`,
      headers: { cookie },
    })
    expect(again.statusCode).toBe(404)
  })
})
