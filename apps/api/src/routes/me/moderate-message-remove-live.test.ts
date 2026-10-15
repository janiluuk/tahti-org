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

const PREFIX = 'moderate-remove-live-'

describe('DELETE /api/me/moderate/:slug/chat/messages/:id tells open chats', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let slug: string
  let channelId: string
  const published: Array<{ channel: string; data: Record<string, unknown> }> = []

  const remove = (id: string) =>
    app.inject({
      method: 'DELETE',
      url: `/api/me/moderate/${slug}/chat/messages/${id}`,
      headers: { cookie: ownerCookie },
    })
  const settle = () => new Promise((r) => setTimeout(r, 0))

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: 'moderate-remove-live-owner',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98570,
    })
    slug = owner.channel!.slug
    channelId = owner.channel!.id
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: { body?: string }) => {
        const body = JSON.parse(String(init?.body ?? '{}'))
        published.push(body.params)
        return new Response('{}', { status: 200 })
      }),
    )
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists each message with its stored id in the public history', async () => {
    const message = await prisma.chatMessage.create({
      data: { channelId, handle: 'Visitor', text: 'has an id' },
    })
    const res = await app.inject({ method: 'GET', url: `/api/chat/${slug}/history` })
    expect(res.json().messages).toContainEqual(
      expect.objectContaining({ id: message.id, text: 'has an id' }),
    )
  })

  it('publishes the removed message id to the public room once', async () => {
    const message = await prisma.chatMessage.create({
      data: { channelId, handle: 'Visitor', text: 'remove me' },
    })
    published.length = 0
    expect((await remove(message.id)).statusCode).toBe(204)
    await settle()
    expect(published).toEqual([
      { channel: `channel:${slug}`, data: { removedMessageId: message.id } },
    ])

    published.length = 0
    expect((await remove(message.id)).statusCode).toBe(204)
    await settle()
    expect(published).toHaveLength(0)
  })

  it('publishes a fan room removal to the fan room', async () => {
    const message = await prisma.chatMessage.create({
      data: { channelId, handle: 'Fan', text: 'fans only', fanOnly: true },
    })
    published.length = 0
    expect((await remove(message.id)).statusCode).toBe(204)
    await settle()
    expect(published).toEqual([
      { channel: `channel:${slug}:fans`, data: { removedMessageId: message.id } },
    ])
  })
})
