// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'chat-react-off-'

describe('POST /api/chat/:slug/react while chat is off', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let slug: string
  let ownerId: string
  const published: string[] = []

  const react = (userAgent: string) =>
    app.inject({
      method: 'POST',
      url: `/api/chat/${slug}/react`,
      headers: { 'user-agent': userAgent },
      payload: { emoji: '🔥' },
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: 'chat-react-off-owner',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98560,
    })
    slug = owner.channel!.slug
    ownerId = owner.id
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: { body?: string }) => {
        published.push(String(init?.body ?? ''))
        return new Response('{}', { status: 200 })
      }),
    )
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('refuses reactions and publishes nothing while the owner has chat off', async () => {
    await prisma.user.update({ where: { id: ownerId }, data: { chatEnabled: false } })
    published.length = 0
    const res = await react('chat-off-browser')
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: 'chat_disabled' })
    expect(published).toHaveLength(0)
  })

  it('accepts reactions again once chat is back on', async () => {
    await prisma.user.update({ where: { id: ownerId }, data: { chatEnabled: true } })
    expect((await react('chat-on-browser')).statusCode).toBe(200)
  })
})
