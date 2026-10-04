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

const PREFIX = 'press-kit-'

describe('M12/M19 — press kit and privacy', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let username: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'press-kit-artist',
      displayName: 'Press Kit Artist',
    })
    username = artist.username
    cookie = await sessionCookieFor(prisma, artist.id)

    await prisma.user.update({
      where: { id: artist.id },
      data: { bio: 'Electronic producer from Helsinki.' },
    })
  })

  afterAll(async () => {
    await prisma.supportTicket.deleteMany({})
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET public press kit', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${username}/press-kit.json`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { displayName: string; email?: string }
    expect(body.displayName).toBe('Press Kit Artist')
    expect(body.email).toBeUndefined()
  })

  it('GET /api/me/press-kit.json includes email', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/press-kit.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().email).toContain('@example.com')
  })

  it('GET /api/me/data-export.json includes what the account made and did', async () => {
    const me = await prisma.user.findUniqueOrThrow({
      where: { username },
      select: { id: true, email: true, channel: { select: { id: true } } },
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'press-kit-other',
    })
    const sound = await prisma.sound.create({
      data: { channelId: me.channel!.id, title: 'Exported Track', status: 'READY', isPublic: true },
    })
    const theirs = await prisma.sound.create({
      data: { channelId: other.channel!.id, title: 'Their Track', status: 'READY', isPublic: true },
    })
    await prisma.comment.create({
      data: { body: 'my comment', authorId: me.id, soundId: theirs.id },
    })
    await prisma.comment.create({
      data: { body: 'not mine', authorId: other.id, soundId: sound.id },
    })
    await prisma.soundLike.create({ data: { userId: me.id, soundId: theirs.id } })
    await prisma.artistFollow.create({ data: { followerUserId: me.id, artistUserId: other.id } })
    await prisma.newsletterSubscriber.create({
      data: {
        artistUserId: other.id,
        email: me.email,
        confirmedAt: new Date(),
        unsubToken: `press-kit-unsub-${Date.now()}`,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.profile.username).toBe(username)
    expect(body.sounds.map((s: { title: string }) => s.title)).toEqual(['Exported Track'])
    expect(body.comments.map((c: { body: string }) => c.body)).toEqual(['my comment'])
    expect(body.comments[0].sound.title).toBe('Their Track')
    expect(body.likes).toHaveLength(1)
    expect(body.following.map((f: { artist: { username: string } }) => f.artist.username)).toEqual([
      'press-kit-other',
    ])
    expect(body.newsletterSubscriptions).toHaveLength(1)
    expect(res.body).not.toContain('not mine')
    expect(res.body).not.toContain(`${PREFIX}other@example.com`)
  })

  it('POST account deletion request creates support ticket', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/account/deletion-request',
      headers: { cookie },
      payload: { reason: 'Leaving the platform' },
    })
    expect(res.statusCode).toBe(200)
    const ticketId = (res.json() as { ticketId: string }).ticketId
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: BigInt(ticketId) },
    })
    expect(ticket?.subject).toBe('Account deletion request')
  })

  it('hides the public press kit, gallery and zip of a suspended or deleted artist', async () => {
    const gone = await createTestArtist(prisma, {
      email: `${PREFIX}gone@example.com`,
      username: 'press-kit-gone',
      displayName: 'Press Kit Gone',
    })
    await prisma.channel.update({
      where: { id: gone.channel!.id },
      data: { pressKitGalleryPublic: true },
    })
    await prisma.pressKitImage.create({
      data: {
        channelId: gone.channel!.id,
        imageKey: 'press/gone.jpg',
        title: 'Promo',
        position: 0,
      },
    })
    const statuses = async () => {
      const kit = await app.inject({
        method: 'GET',
        url: '/api/v1/u/press-kit-gone/press-kit.json',
      })
      const zip = await app.inject({ method: 'GET', url: '/api/v1/u/press-kit-gone/press-kit.zip' })
      const images = await app.inject({
        method: 'GET',
        url: '/api/v1/u/press-kit-gone/press-kit-images.json',
      })
      return [kit.statusCode, zip.statusCode, (images.json() as unknown[]).length]
    }
    const before = await statuses()
    expect(before[0]).toBe(200)
    expect(before[2]).toBe(1)

    await prisma.user.update({ where: { id: gone.id }, data: { suspendedAt: new Date() } })
    expect(await statuses()).toEqual([404, 404, 0])

    await prisma.user.update({
      where: { id: gone.id },
      data: { suspendedAt: null, deletedAt: new Date() },
    })
    expect(await statuses()).toEqual([404, 404, 0])
  })
})
