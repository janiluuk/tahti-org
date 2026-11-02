// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { SoundAudienceResponseSchema } from '@tahti/shared'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
} from '../../test/helpers.js'

const PREFIX = 'sound-audience-paging-'

describe('sound audience paging', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let url: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    const sound = await createReadySound(prisma, artist.channel!.id, 'Paged track')
    await prisma.sound.update({ where: { id: sound.id }, data: { isPublic: true } })
    url = `/api/v1/c/${artist.channel!.slug}/sounds/${sound.id}/audience`
    for (let n = 0; n < 3; n++) {
      const fan = await createTestArtist(prisma, {
        email: `${PREFIX}fan${n}@example.com`,
        username: `${PREFIX}fan${n}`,
      })
      await prisma.soundLike.create({
        data: { userId: fan.id, soundId: sound.id, createdAt: new Date(Date.now() - n * 60_000) },
      })
    }
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('pages one list with tab, limit and offset', async () => {
    const res = await app.inject({ method: 'GET', url: `${url}?tab=likes&limit=2&offset=2` })
    expect(res.statusCode).toBe(200)
    const body = SoundAudienceResponseSchema.parse(res.json())
    expect(body.likes.total).toBe(3)
    expect(body.likes.items.map((p) => p.username)).toEqual([`${PREFIX}fan2`])
    expect(body.collections).toEqual({ total: 0, items: [] })
    expect(body.plays).toEqual({ total: 0, items: [] })
  })

  it('rejects an unknown tab', async () => {
    const res = await app.inject({ method: 'GET', url: `${url}?tab=nope` })
    expect(res.statusCode).toBe(400)
  })
})
