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

const PREFIX = 'me-listening-hidden-'

describe('GET /api/me/listening leaves out hidden artists and tracks', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  const channelIds: string[] = []

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const listener = await createTestArtist(prisma, {
      email: `${PREFIX}listener@example.com`,
      username: `${PREFIX}listener`,
    })
    cookie = await sessionCookieFor(prisma, listener.id)
    const make = async (tag: string) => {
      const artist = await createTestArtist(prisma, {
        email: `${PREFIX}${tag}@example.com`,
        username: `${PREFIX}${tag}`,
      })
      channelIds.push(artist.channel!.id)
      return artist
    }
    const visible = await make('visible')
    const suspended = await make('suspended')
    await prisma.user.update({ where: { id: suspended.id }, data: { suspendedAt: new Date() } })

    const publicTrack = await prisma.sound.create({
      data: { channelId: visible.channel!.id, title: 'Public', status: 'READY', isPublic: true },
    })
    const privateTrack = await prisma.sound.create({
      data: { channelId: visible.channel!.id, title: 'Private', status: 'READY', isPublic: false },
    })
    const suspendedTrack = await prisma.sound.create({
      data: { channelId: suspended.channel!.id, title: 'Gone', status: 'READY', isPublic: true },
    })
    const ownTrack = await prisma.sound.create({
      data: {
        channelId: listener.channel!.id,
        title: 'Own draft',
        status: 'READY',
        isPublic: false,
      },
    })
    channelIds.push(listener.channel!.id)

    const now = Date.now()
    const session = (i: number, channelId: string, soundId: string, minutes: number) => ({
      channelId,
      soundId,
      byUserId: listener.id,
      byFingerprint: `${PREFIX}${i}`,
      byIpHash: 'x',
      source: 'CHANNEL_PAGE' as const,
      startedAt: new Date(now - minutes * 60_000),
      lastSeenAt: new Date(now),
    })
    await prisma.listenSession.createMany({
      data: [
        session(1, suspended.channel!.id, suspendedTrack.id, 90),
        session(2, visible.channel!.id, privateTrack.id, 60),
        session(3, visible.channel!.id, publicTrack.id, 10),
        session(4, listener.channel!.id, ownTrack.id, 5),
      ],
    })
  })

  afterAll(async () => {
    await prisma.listenSession.deleteMany({ where: { channelId: { in: channelIds } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('names only available artists and public (or own) tracks, but counts all minutes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/listening?range=7',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      minutes: number
      topArtists: { username: string }[]
      topTracks: { title: string }[]
    }
    expect(body.minutes).toBe(165)
    expect(body.topArtists.map((a) => a.username)).toEqual([
      `${PREFIX}visible`,
      `${PREFIX}listener`,
    ])
    expect(body.topTracks.map((t) => t.title)).toEqual(['Public', 'Own draft'])
  })
})
