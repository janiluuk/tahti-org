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

const PREFIX = 'moderate-leave-'

describe('DELETE /api/me/moderate/:slug and the moderated channel list', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let modCookie: string
  let outsiderCookie: string
  let ownerId: string
  let modId: string
  let slug: string
  let channelId: string
  let secondSlug: string

  const leave = (channelSlug: string, cookie: string) =>
    app.inject({ method: 'DELETE', url: `/api/me/moderate/${channelSlug}`, headers: { cookie } })
  const moderated = async (cookie: string) =>
    (
      (
        await app.inject({ method: 'GET', url: '/api/me/moderate', headers: { cookie } })
      ).json() as Array<{
        slug: string
        isOwner: boolean
      }>
    )
      .filter((c) => !c.isOwner)
      .map((c) => c.slug)

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: 'moderate-leave-owner',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98570,
    })
    const second = await createTestArtist(prisma, {
      email: `${PREFIX}second@example.com`,
      username: 'moderate-leave-second',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98571,
    })
    const moderator = await createTestArtist(prisma, {
      email: `${PREFIX}mod@example.com`,
      username: 'moderate-leave-mod',
      memberNumber: 98572,
    })
    const outsider = await createTestArtist(prisma, {
      email: `${PREFIX}outsider@example.com`,
      username: 'moderate-leave-outsider',
      memberNumber: 98573,
    })
    ownerId = owner.id
    modId = moderator.id
    slug = owner.channel!.slug
    channelId = owner.channel!.id
    secondSlug = second.channel!.slug
    await prisma.channelModerator.createMany({
      data: [
        { channelId, userId: moderator.id },
        { channelId: second.channel!.id, userId: moderator.id },
      ],
    })
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    modCookie = await sessionCookieFor(prisma, moderator.id)
    outsiderCookie = await sessionCookieFor(prisma, outsider.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires a session, and answers 404 to an account that is not a moderator', async () => {
    const anonymous = await app.inject({ method: 'DELETE', url: `/api/me/moderate/${slug}` })
    expect(anonymous.statusCode).toBe(401)
    expect((await leave(slug, outsiderCookie)).statusCode).toBe(404)
    expect((await leave('no-such-channel-anywhere', modCookie)).statusCode).toBe(404)
  })

  it('does not let the owner leave their own channel', async () => {
    expect((await leave(slug, ownerCookie)).statusCode).toBe(400)
  })

  it('leaves a suspended owner out of the list of channels to moderate', async () => {
    expect((await moderated(modCookie)).sort()).toEqual([slug, secondSlug].sort())
    await prisma.user.update({ where: { id: ownerId }, data: { suspendedAt: new Date() } })
    expect(await moderated(modCookie)).toEqual([secondSlug])
    await prisma.user.update({ where: { id: ownerId }, data: { suspendedAt: null } })
  })

  it('a moderator steps down from one channel and keeps the other', async () => {
    expect((await leave(slug, modCookie)).statusCode).toBe(204)
    expect(await moderated(modCookie)).toEqual([secondSlug])
    expect(await prisma.channelModerator.count({ where: { channelId, userId: modId } })).toBe(0)

    const bans = await app.inject({
      method: 'GET',
      url: `/api/me/moderate/${slug}/chat/bans`,
      headers: { cookie: modCookie },
    })
    expect(bans.statusCode).toBe(404)
    expect((await leave(slug, modCookie)).statusCode).toBe(404)
  })
})
