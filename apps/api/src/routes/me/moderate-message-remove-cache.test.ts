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

const cache = vi.hoisted(() => ({ invalidated: [] as string[] }))
vi.mock('../../lib/json-cache.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/json-cache.js')>()),
  invalidateCachedJson: async (key: string) => {
    cache.invalidated.push(key)
  },
}))

const PREFIX = 'moderate-remove-cache-'

describe('DELETE /api/me/moderate/:slug/chat/messages/:id and the history cache', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let slug: string
  let channelId: string

  const remove = (id: string) =>
    app.inject({
      method: 'DELETE',
      url: `/api/me/moderate/${slug}/chat/messages/${id}`,
      headers: { cookie: ownerCookie },
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: 'moderate-remove-cache-owner',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98580,
    })
    slug = owner.channel!.slug
    channelId = owner.channel!.id
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 200 })),
    )
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('evicts the public history for a public message and the fan history for a fan one', async () => {
    const open = await prisma.chatMessage.create({
      data: { channelId, handle: 'Visitor', text: 'public line' },
    })
    const fans = await prisma.chatMessage.create({
      data: { channelId, handle: 'Fan', text: 'fan line', fanOnly: true },
    })
    cache.invalidated.length = 0
    expect((await remove(open.id)).statusCode).toBe(204)
    expect((await remove(fans.id)).statusCode).toBe(204)
    expect(cache.invalidated).toEqual([`chat-history:${slug}`, `chat-fan-history:${slug}`])

    cache.invalidated.length = 0
    expect((await remove(open.id)).statusCode).toBe(204)
    expect(cache.invalidated).toEqual([])
  })
})
