// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'sublist-susp-'
const LISTS = ['posts', 'embeds', 'members']

describe("a suspended artist's channel lists", () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const slug = `${PREFIX}artist`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: slug,
      tier: 'ARTIST',
    })
    await prisma.artistPost.create({
      data: { userId: artist.id, title: 'Tour news', body: 'Dates out', publishAt: new Date() },
    })
    await prisma.artistEmbed.create({
      data: { userId: artist.id, provider: 'youtube', url: 'https://youtube.com/watch?v=x' },
    })
    await prisma.channelMember.create({
      data: { channelId: artist.channel!.id, name: 'Drummer', role: 'drums', position: 0 },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists them in good standing', async () => {
    for (const list of LISTS) {
      const res = await app.inject({ method: 'GET', url: `/api/channels/${slug}/${list}` })
      expect(res.statusCode, list).toBe(200)
      expect((res.json() as unknown[]).length, list).toBe(1)
    }
  })

  it('lists nothing once the owner is suspended, like events', async () => {
    await prisma.user.update({
      where: { username: slug },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    })
    for (const list of LISTS) {
      const res = await app.inject({ method: 'GET', url: `/api/channels/${slug}/${list}` })
      expect(res.statusCode, list).toBe(200)
      expect(res.json(), list).toEqual([])
    }
  })
})
