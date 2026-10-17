// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'feed-susp-'

describe('the follower feed and suspended artists', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let suspendedId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: `${PREFIX}fan`,
    })
    const kept = await createTestArtist(prisma, {
      email: `${PREFIX}kept@example.com`,
      username: `${PREFIX}kept`,
    })
    const suspended = await createTestArtist(prisma, {
      email: `${PREFIX}suspended@example.com`,
      username: `${PREFIX}suspended`,
    })
    suspendedId = suspended.id
    cookie = await sessionCookieFor(prisma, fan.id)
    await prisma.artistFollow.createMany({
      data: [
        { followerUserId: fan.id, artistUserId: kept.id },
        { followerUserId: fan.id, artistUserId: suspended.id },
      ],
    })
    for (const artist of [kept, suspended]) {
      const sound = await createReadySound(prisma, artist.channel!.id, `${artist.username} track`)
      await prisma.sound.update({ where: { id: sound.id }, data: { isPublic: true } })
      await prisma.artistPost.create({
        data: { userId: artist.id, body: `${artist.username} post`, publishAt: new Date() },
      })
    }
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const titles = async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/feed', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    return JSON.stringify(res.json())
  }

  it("leaves a suspended artist's posts and tracks out", async () => {
    const before = await titles()
    expect(before).toContain(`${PREFIX}suspended track`)

    await prisma.user.update({
      where: { id: suspendedId },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    })
    const after = await titles()
    expect(after).toContain(`${PREFIX}kept track`)
    expect(after).not.toContain(`${PREFIX}suspended track`)
    expect(after).not.toContain(`${PREFIX}suspended post`)
  })
})
