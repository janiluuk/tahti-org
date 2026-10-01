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

const PREFIX = 'col-sub-notify-'

describe('collection subscribers hear about new tracks', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let contributorCookie: string
  let ownerChannelId: string
  let subscriberId: string

  const notificationsFor = (userId: string) =>
    prisma.notification.findMany({
      where: { userId, type: 'PLAYLIST_TRACK_ADDED' },
      orderBy: { createdAt: 'asc' },
      select: { title: true, url: true },
    })

  const collection = async (slug: string, data: Record<string, unknown> = {}) => {
    const owner = await prisma.user.findUniqueOrThrow({ where: { username: `${PREFIX}owner` } })
    const col = await prisma.collection.create({
      data: { userId: owner.id, slug, name: slug, ...data },
    })
    await prisma.collectionSubscription.create({
      data: { userId: subscriberId, collectionId: col.id },
    })
    return col
  }

  const track = (title: string, isPublic = true) =>
    prisma.sound.create({
      data: { channelId: ownerChannelId, title, status: 'READY', isPublic },
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
      displayName: 'Playlist Owner',
    })
    const contributor = await createTestArtist(prisma, {
      email: `${PREFIX}contributor@example.com`,
      username: `${PREFIX}contributor`,
    })
    const subscriber = await createTestArtist(prisma, {
      email: `${PREFIX}subscriber@example.com`,
      username: `${PREFIX}subscriber`,
    })
    ownerChannelId = owner.channel!.id
    subscriberId = subscriber.id
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    contributorCookie = await sessionCookieFor(prisma, contributor.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('tells subscribers when the owner adds a public track, but not a private one', async () => {
    const col = await collection(`${PREFIX}public`)
    const shown = await track('Shown track')
    const hidden = await track('Hidden track', false)

    for (const soundId of [shown.id, hidden.id]) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/me/collections/${col.slug}/items`,
        headers: { cookie: ownerCookie },
        payload: { soundId },
      })
      expect(res.statusCode).toBe(201)
    }

    const notes = await notificationsFor(subscriberId)
    expect(notes).toEqual([
      {
        title: `Playlist Owner added "Shown track" to ${col.name}`,
        url: `/u/${PREFIX}owner/c/${col.slug}`,
      },
    ])
  })

  it('tells subscribers when someone adds to a collaborative playlist', async () => {
    const col = await collection(`${PREFIX}collab`, { collaborative: true })
    const sound = await track('Collab track')
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${col.slug}/items`,
      headers: { cookie: contributorCookie },
      payload: { soundId: sound.id },
    })
    expect(res.statusCode).toBe(201)
    const notes = await notificationsFor(subscriberId)
    expect(notes.some((n) => n.title.includes('"Collab track"'))).toBe(true)
  })

  it('stays quiet for subscribers of a draft collection', async () => {
    const col = await collection(`${PREFIX}draft`, { isPublic: false, visibility: 'DRAFT' })
    const before = (await notificationsFor(subscriberId)).length
    const sound = await track('Draft track')
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/collections/${col.slug}/items`,
      headers: { cookie: ownerCookie },
      payload: { soundId: sound.id },
    })
    expect(res.statusCode).toBe(201)
    expect((await notificationsFor(subscriberId)).length).toBe(before)
  })
})
