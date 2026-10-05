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

const PREFIX = 'block-engage-'

describe('POST /api/me/blocks — loves and reposts', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('removes the loves and reposts between the two and keeps everyone else’s', async () => {
    const makeArtist = async (name: string) => {
      const artist = await createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `${PREFIX}${name}`,
      })
      const sound = await prisma.sound.create({
        data: {
          channelId: artist.channel!.id,
          title: `${name} track`,
          status: 'READY',
          isPublic: true,
        },
      })
      return { id: artist.id, soundId: sound.id }
    }
    const me = await makeArtist('me')
    const them = await makeArtist('them')
    const bystander = await makeArtist('bystander')

    const pairs = [
      { userId: them.id, soundId: me.soundId },
      { userId: me.id, soundId: them.soundId },
      { userId: bystander.id, soundId: me.soundId },
      { userId: me.id, soundId: bystander.soundId },
      { userId: them.id, soundId: bystander.soundId },
    ]
    await prisma.soundLike.createMany({ data: pairs })
    await prisma.soundRepost.createMany({ data: pairs })

    const res = await app.inject({
      method: 'POST',
      url: '/api/me/blocks',
      headers: { cookie: await sessionCookieFor(prisma, me.id) },
      payload: { username: `${PREFIX}them` },
    })
    expect(res.statusCode).toBe(201)

    const involved = { userId: { in: [me.id, them.id, bystander.id] } }
    const likes = await prisma.soundLike.findMany({
      where: involved,
      select: { userId: true, soundId: true },
    })
    const reposts = await prisma.soundRepost.findMany({
      where: involved,
      select: { userId: true, soundId: true },
    })
    const kept = pairs.slice(2)
    expect(likes).toHaveLength(kept.length)
    expect(likes).toEqual(expect.arrayContaining(kept))
    expect(reposts).toHaveLength(kept.length)
    expect(reposts).toEqual(expect.arrayContaining(kept))
  })
})
