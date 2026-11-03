// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'artist-avatar-lists-'
const GENRE = 'Avatar List Genre'
const AVATAR = 'https://media.example/owner-avatar.png'

type Row = { title: string; artistName: string; artistAvatarUrl?: string | null }

describe('artist avatars on public track lists', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
      displayName: 'Avatar Owner',
    })
    await prisma.user.update({ where: { id: owner.id }, data: { avatarUrl: AVATAR } })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: `${PREFIX}fan`,
    })

    const track = (title: string, artistName: string | null) =>
      prisma.sound.create({
        data: {
          channelId: owner.channel!.id,
          title,
          artistName,
          status: 'READY',
          isPublic: true,
          genre: GENRE,
          mp3Key: `mp3/${PREFIX}${title}.mp3`,
        },
      })
    const own = await track('Own track', null)
    const guest = await track('Guest track', 'Someone Else')

    await prisma.listenEvent.createMany({
      data: [
        { soundId: own.id, dedupeKey: `${PREFIX}a`, dayBucket: '2026-11-01' },
        { soundId: guest.id, dedupeKey: `${PREFIX}b`, dayBucket: '2026-11-01' },
      ],
    })
    for (const soundId of [own.id, guest.id]) {
      await prisma.trackReaction.create({
        data: { soundId, userId: fan.id, type: 'LOVE', positionSec: 1 },
      })
    }
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  function expectAvatars(rows: Row[]) {
    const own = rows.find((row) => row.title === 'Own track')
    const guest = rows.find((row) => row.title === 'Guest track')
    expect(own?.artistAvatarUrl).toBe(AVATAR)
    expect(guest?.artistName).toBe('Someone Else')
    expect(guest?.artistAvatarUrl).toBeNull()
  }

  const genre = encodeURIComponent(GENRE)

  it('top list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/top-lists?period=all_time&genre=${genre}`,
    })
    expect(res.statusCode).toBe(200)
    expectAvatars(res.json().entries)
  })

  it('loved list', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/top-lists/loved?genre=${genre}` })
    expect(res.statusCode).toBe(200)
    expectAvatars(res.json().entries)
  })

  it('latest tracks', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/discover/latest-tracks?genre=${genre}`,
    })
    expect(res.statusCode).toBe(200)
    expectAvatars(res.json().items)
  })
})
