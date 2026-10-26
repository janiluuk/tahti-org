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

const PREFIX = 'me-listening-test-'

describe('GET /api/me/listening', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelIds: string[] = []

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const listener = await createTestArtist(prisma, {
      email: `${PREFIX}listener@example.com`,
      username: `${PREFIX}listener`,
      displayName: 'Listener',
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
      displayName: 'Other Listener',
    })
    const loved = await createTestArtist(prisma, {
      email: `${PREFIX}loved@example.com`,
      username: `${PREFIX}loved`,
      displayName: 'Loved Artist',
    })
    const emailNamed = await createTestArtist(prisma, {
      email: `${PREFIX}emailnamed@example.com`,
      username: `${PREFIX}emailnamed`,
      displayName: 'placeholder',
    })
    await prisma.user.update({
      where: { id: emailNamed.id },
      data: { displayName: `${PREFIX}emailnamed@example.com` },
    })
    cookie = await sessionCookieFor(prisma, listener.id)
    channelIds = [loved.channel!.id, emailNamed.channel!.id]
    const track = await prisma.sound.create({
      data: { channelId: loved.channel!.id, title: 'Long Song', status: 'READY', isPublic: true },
    })
    const now = Date.now()
    const session = (
      channelId: string,
      userId: string,
      minutes: number,
      extra: { soundId?: string; daysAgo?: number } = {},
    ) => ({
      channelId,
      byUserId: userId,
      soundId: extra.soundId ?? null,
      byFingerprint: `${PREFIX}${Math.random()}`,
      byIpHash: 'x',
      source: 'CHANNEL_PAGE' as const,
      startedAt: new Date(now - (extra.daysAgo ?? 0) * 86_400_000 - minutes * 60_000),
      lastSeenAt: new Date(now - (extra.daysAgo ?? 0) * 86_400_000),
    })
    await prisma.listenSession.createMany({
      data: [
        session(loved.channel!.id, listener.id, 30, { soundId: track.id }),
        session(loved.channel!.id, listener.id, 15),
        session(emailNamed.channel!.id, listener.id, 12),
        session(emailNamed.channel!.id, listener.id, 60, { daysAgo: 40 }),
        session(loved.channel!.id, other.id, 500),
      ],
    })
  })

  afterAll(async () => {
    await prisma.listenSession.deleteMany({ where: { channelId: { in: channelIds } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const get = (query: string, withCookie = true) =>
    app.inject({
      method: 'GET',
      url: `/api/me/listening${query}`,
      headers: withCookie ? { cookie } : {},
    })

  it("adds up the caller's own listening and ranks artists and tracks by time", async () => {
    const res = await get('?range=30')
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({ range: '30', minutes: 57, listens: 3 })
    expect(
      body.topArtists.map((a: { displayName: string; minutes: number }) => [
        a.displayName,
        a.minutes,
      ]),
    ).toEqual([
      ['Loved Artist', 45],
      [`${PREFIX}emailnamed`, 12],
    ])
    expect(body.topTracks).toEqual([
      { soundId: expect.any(String), title: 'Long Song', artistName: 'Loved Artist', minutes: 30 },
    ])
    expect(JSON.stringify(body)).not.toContain('@example.com')
  })

  it('includes older listening for all time', async () => {
    expect((await get('?range=all')).json()).toMatchObject({ minutes: 117, listens: 4 })
  })

  it('needs a signed-in caller', async () => {
    expect((await get('', false)).statusCode).toBe(401)
  })
})
