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

const PREFIX = 'col-add-processing-'

describe('adding a track that is still processing', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let otherCookie: string
  let channelId: string
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    channelId = owner.channel!.id
    userId = owner.id
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    otherCookie = await sessionCookieFor(prisma, other.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const add = async (cookie: string, slug: string, soundId: string) =>
    app.inject({
      method: 'POST',
      url: `/api/me/collections/${slug}/items`,
      headers: { cookie },
      payload: { soundId },
    })

  it('tells the owner the track is still processing', async () => {
    const slug = `${PREFIX}ep`
    await prisma.collection.create({ data: { userId, slug, name: 'EP' } })
    const pending = await prisma.sound.create({
      data: { channelId, title: 'Fresh upload', status: 'PENDING' },
    })

    const res = await add(ownerCookie, slug, pending.id)

    expect(res.statusCode).toBe(409)
    expect(res.json()).toMatchObject({ code: 'SOUND_NOT_READY' })
  })

  it("keeps someone else's processing track hidden", async () => {
    const otherUser = await prisma.user.findFirstOrThrow({
      where: { email: `${PREFIX}other@example.com` },
    })
    const slug = `${PREFIX}other-list`
    await prisma.collection.create({ data: { userId: otherUser.id, slug, name: 'Mine' } })
    const pending = await prisma.sound.create({
      data: { channelId, title: 'Not yours', status: 'PROCESSING', isPublic: true },
    })

    const res = await add(otherCookie, slug, pending.id)

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Sound item not found')
  })
})
