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

const PREFIX = 'chat-history-off-'

describe('chat history while the owner has chat switched off', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerId: string
  let ownerCookie: string
  let slug: string

  const history = async () =>
    (await app.inject({ method: 'GET', url: `/api/chat/${slug}/history` })).json()
  const fanHistory = async () =>
    (
      await app.inject({
        method: 'GET',
        url: `/api/chat/${slug}/fan-history`,
        headers: { cookie: ownerCookie },
      })
    ).json()

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: 'chat-history-off-owner',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98560,
    })
    ownerId = owner.id
    slug = owner.channel!.slug
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    await prisma.fanTier.create({
      data: { artistUserId: owner.id, name: 'Supporter', amountCents: 500, perks: ['FAN_CHAT'] },
    })
    await prisma.chatMessage.createMany({
      data: [
        { channelId: owner.channel!.id, handle: 'Aino', text: 'said in public' },
        { channelId: owner.channel!.id, handle: 'Ville', text: 'said to fans', fanOnly: true },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('serves both histories while chat is on', async () => {
    expect((await history()).messages.map((m: { text: string }) => m.text)).toEqual([
      'said in public',
    ])
    expect((await fanHistory()).messages.map((m: { text: string }) => m.text)).toEqual([
      'said to fans',
    ])
  })

  it('serves neither once chat is switched off, and both again when it is back on', async () => {
    await prisma.user.update({ where: { id: ownerId }, data: { chatEnabled: false } })
    expect(await history()).toEqual({ messages: [] })
    expect(await fanHistory()).toEqual({ messages: [] })

    await prisma.user.update({ where: { id: ownerId }, data: { chatEnabled: true } })
    expect((await history()).messages).toHaveLength(1)
    expect((await fanHistory()).messages).toHaveLength(1)
  })
})
