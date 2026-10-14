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

const PREFIX = 'moderate-message-remove-'

describe('DELETE /api/me/moderate/:slug/chat/messages/:id', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let modCookie: string
  let outsiderCookie: string
  let slug: string
  let channelId: string

  const add = (text: string, extra: Record<string, unknown> = {}) =>
    prisma.chatMessage.create({ data: { channelId, handle: 'Visitor', text, ...extra } })
  const remove = (id: string, cookie: string) =>
    app.inject({
      method: 'DELETE',
      url: `/api/me/moderate/${slug}/chat/messages/${id}`,
      headers: { cookie },
    })
  const texts = async (url: string, cookie?: string) => {
    const res = await app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} })
    return (res.json().messages as Array<{ text: string }>).map((m) => m.text)
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: 'moderate-msg-rm-owner',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98530,
    })
    const moderator = await createTestArtist(prisma, {
      email: `${PREFIX}mod@example.com`,
      username: 'moderate-msg-rm-mod',
      memberNumber: 98531,
    })
    const outsider = await createTestArtist(prisma, {
      email: `${PREFIX}outsider@example.com`,
      username: 'moderate-msg-rm-outsider',
      memberNumber: 98532,
    })
    slug = owner.channel!.slug
    channelId = owner.channel!.id
    await prisma.fanTier.create({
      data: { artistUserId: owner.id, name: 'Supporter', amountCents: 500, perks: ['FAN_CHAT'] },
    })
    await prisma.channelModerator.create({ data: { channelId, userId: moderator.id } })
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    modCookie = await sessionCookieFor(prisma, moderator.id)
    outsiderCookie = await sessionCookieFor(prisma, outsider.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('a moderator removes a message from the public history and from the moderation list', async () => {
    await add('a message that stays')
    const bad = await add('a message nobody should read')

    expect((await remove(bad.id, outsiderCookie)).statusCode).toBe(404)
    expect((await remove(bad.id, modCookie)).statusCode).toBe(204)

    const history = await texts(`/api/chat/${slug}/history`)
    expect(history).toContain('a message that stays')
    expect(history).not.toContain('a message nobody should read')

    const moderation = await texts(`/api/me/moderate/${slug}/chat/messages`, modCookie)
    expect(moderation).toContain('a message that stays')
    expect(moderation).not.toContain('a message nobody should read')

    const row = await prisma.chatMessage.findUniqueOrThrow({ where: { id: bad.id } })
    expect(row.text).toBe('a message nobody should read')
    expect(row.removedAt).not.toBeNull()
  })

  it('removing twice keeps the first removal', async () => {
    const message = await add('removed twice')
    await remove(message.id, modCookie)
    const first = await prisma.chatMessage.findUniqueOrThrow({ where: { id: message.id } })
    expect((await remove(message.id, ownerCookie)).statusCode).toBe(204)
    const second = await prisma.chatMessage.findUniqueOrThrow({ where: { id: message.id } })
    expect(second.removedAt).toEqual(first.removedAt)
    expect(second.removedByUserId).toBe(first.removedByUserId)
  })

  it('removes a fan room message from the fan history', async () => {
    const message = await add('said in the fan room', { fanOnly: true })
    expect(await texts(`/api/chat/${slug}/fan-history`, ownerCookie)).toContain(
      'said in the fan room',
    )
    expect((await remove(message.id, ownerCookie)).statusCode).toBe(204)
    expect(await texts(`/api/chat/${slug}/fan-history`, ownerCookie)).not.toContain(
      'said in the fan room',
    )
  })

  it("leaves the owner's own messages to the owner", async () => {
    const message = await add('a word from the artist', { channelRole: 'owner' })
    expect((await remove(message.id, modCookie)).statusCode).toBe(403)
    expect((await remove(message.id, ownerCookie)).statusCode).toBe(204)
  })

  it('does not reach a message of another channel', async () => {
    const other = await prisma.channel.findFirstOrThrow({
      where: { user: { email: `${PREFIX}outsider@example.com` } },
    })
    const elsewhere = await prisma.chatMessage.create({
      data: { channelId: other.id, handle: 'Someone', text: 'said in another room' },
    })
    expect((await remove(elsewhere.id, ownerCookie)).statusCode).toBe(404)
    const row = await prisma.chatMessage.findUniqueOrThrow({ where: { id: elsewhere.id } })
    expect(row.removedAt).toBeNull()
  })
})
