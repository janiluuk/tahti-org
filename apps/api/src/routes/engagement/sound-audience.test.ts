// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { SoundAudienceResponseSchema, type SoundAudienceResponse } from '@tahti/shared'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
} from '../../test/helpers.js'

const PREFIX = 'sound-audience-'

describe('GET /api/v1/c/:slug/sounds/:itemId/audience', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let url: string
  let privateUrl: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: `${PREFIX}fan`,
      displayName: 'Fan One',
    })
    await prisma.user.update({
      where: { id: fan.id },
      data: { avatarUrl: 'https://media.example/fan.png' },
    })
    const emailNamed = await createTestArtist(prisma, {
      email: `${PREFIX}mail@example.com`,
      username: `${PREFIX}mail`,
      displayName: 'someone@example.com',
    })
    const suspended = await createTestArtist(prisma, {
      email: `${PREFIX}suspended@example.com`,
      username: `${PREFIX}suspended`,
    })
    await prisma.user.update({ where: { id: suspended.id }, data: { suspendedAt: new Date() } })

    const sound = await createReadySound(prisma, artist.channel!.id, 'Audience track')
    await prisma.sound.update({ where: { id: sound.id }, data: { isPublic: true } })
    const hidden = await createReadySound(prisma, artist.channel!.id, 'Private track')
    await prisma.sound.update({ where: { id: hidden.id }, data: { isPublic: false } })
    url = `/api/v1/c/${artist.channel!.slug}/sounds/${sound.id}/audience`
    privateUrl = `/api/v1/c/${artist.channel!.slug}/sounds/${hidden.id}/audience`

    await prisma.collection.create({
      data: {
        userId: fan.id,
        slug: `${PREFIX}public`,
        name: 'Public mix',
        items: { create: [{ soundId: sound.id, position: 0 }] },
      },
    })
    await prisma.collection.create({
      data: {
        userId: fan.id,
        slug: `${PREFIX}private`,
        name: 'Private mix',
        isPublic: false,
        visibility: 'DRAFT',
        items: { create: [{ soundId: sound.id, position: 0 }] },
      },
    })

    for (const user of [fan, emailNamed, suspended]) {
      await prisma.soundLike.create({ data: { userId: user.id, soundId: sound.id } })
    }
    await prisma.soundRepost.create({ data: { userId: fan.id, soundId: sound.id } })

    const session = (byUserId: string | null, n: number) => ({
      channelId: artist.channel!.id,
      soundId: sound.id,
      byUserId,
      byFingerprint: `${PREFIX}fp-${n}`,
      byIpHash: `${PREFIX}ip-${n}`,
      source: 'CHANNEL_PAGE' as const,
    })
    await prisma.listenSession.createMany({
      data: [
        session(fan.id, 1),
        session(fan.id, 2),
        session(emailNamed.id, 3),
        session(null, 4),
        session(artist.id, 5),
        session(suspended.id, 6),
      ],
    })
  })

  afterAll(async () => {
    await prisma.listenSession.deleteMany({ where: { byFingerprint: { startsWith: PREFIX } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  async function audience(): Promise<SoundAudienceResponse> {
    const res = await app.inject({ method: 'GET', url })
    expect(res.statusCode).toBe(200)
    return SoundAudienceResponseSchema.parse(res.json())
  }

  it('lists only public collections the sound is in', async () => {
    const body = await audience()
    expect(body.collections.total).toBe(1)
    expect(body.collections.items[0]).toMatchObject({
      name: 'Public mix',
      ownerName: 'Fan One',
      itemCount: 1,
    })
  })

  it('lists likers and reposters without suspended accounts or email names', async () => {
    const body = await audience()
    expect(body.likes.total).toBe(2)
    const names = body.likes.items.map((p) => p.displayName)
    expect(names).toContain('Fan One')
    expect(names).toContain(`${PREFIX}mail`)
    expect(names.join(' ')).not.toContain('@example.com')
    expect(body.likes.items.find((p) => p.displayName === 'Fan One')?.avatarUrl).toBe(
      'https://media.example/fan.png',
    )
    expect(body.reposts).toMatchObject({ total: 1, items: [{ displayName: 'Fan One' }] })
  })

  it('lists signed-in listeners with play counts, never anonymous ones or the artist', async () => {
    const body = await audience()
    expect(body.plays.total).toBe(2)
    const fan = body.plays.items.find((p) => p.displayName === 'Fan One')
    expect(fan?.plays).toBe(2)
    expect(body.plays.items.map((p) => p.username)).not.toContain(`${PREFIX}artist`)
  })

  it('answers 404 for a private track', async () => {
    const res = await app.inject({ method: 'GET', url: privateUrl })
    expect(res.statusCode).toBe(404)
  })
})
