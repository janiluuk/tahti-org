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

const PREFIX = 'chat-subs-only-staff-'

describe('subscribers-only chat and the people who run it', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const slug = `${PREFIX}artist`
  const cookies: Record<string, string> = {}

  const access = async (who: string) =>
    (
      await app.inject({
        method: 'GET',
        url: `/api/chat/${slug}/access`,
        headers: { cookie: cookies[who]! },
      })
    ).json() as { subscribersOnly: boolean; canPostInChat: boolean }

  const token = (who: string) =>
    app.inject({
      method: 'POST',
      url: `/api/chat/${slug}/token`,
      headers: { cookie: cookies[who]! },
      payload: { handle: who },
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const [owner, moderator, listener] = await Promise.all(
      ['artist', 'moderator', 'listener'].map((name) =>
        createTestArtist(prisma, {
          email: `${PREFIX}${name}@example.com`,
          username: `${PREFIX}${name}`,
        }),
      ),
    )
    await prisma.channel.update({
      where: { id: owner!.channel!.id },
      data: { chatSubscribersOnly: true },
    })
    await prisma.channelModerator.create({
      data: { channelId: owner!.channel!.id, userId: moderator!.id },
    })
    cookies.owner = await sessionCookieFor(prisma, owner!.id)
    cookies.moderator = await sessionCookieFor(prisma, moderator!.id)
    cookies.listener = await sessionCookieFor(prisma, listener!.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lets the owner post in their own subscribers-only chat', async () => {
    expect(await access('owner')).toMatchObject({ subscribersOnly: true, canPostInChat: true })
    const res = await token('owner')
    expect(res.statusCode).toBe(200)
    expect(res.json().channelRole).toBe('owner')
  })

  it('lets a moderator post there', async () => {
    expect(await access('moderator')).toMatchObject({ canPostInChat: true })
    const res = await token('moderator')
    expect(res.statusCode).toBe(200)
    expect(res.json().channelRole).toBe('moderator')
  })

  it('still asks everyone else to subscribe', async () => {
    expect(await access('listener')).toMatchObject({ canPostInChat: false })
    const res = await token('listener')
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: 'subscribers_only' })
  })
})
