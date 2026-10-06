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

const PREFIX = 'col-suspended-'

describe('collections and suspended accounts', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let guestCookie: string
  let suspendedSoundId: string
  const mixSlug = `${PREFIX}mix`
  const ownSlug = `${PREFIX}own`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const [curator, suspended, guest] = await Promise.all(
      ['curator', 'gone', 'guest'].map((name) =>
        createTestArtist(prisma, {
          email: `${PREFIX}${name}@example.com`,
          username: `${PREFIX}${name}`,
        }),
      ),
    )
    guestCookie = await sessionCookieFor(prisma, guest!.id)
    const track = (channelId: string, title: string) =>
      prisma.sound.create({ data: { channelId, title, status: 'READY', isPublic: true } })
    const kept = await track(curator!.channel!.id, `${PREFIX}kept`)
    const hidden = await track(suspended!.channel!.id, `${PREFIX}hidden`)
    suspendedSoundId = hidden.id

    const mix = await prisma.collection.create({
      data: {
        userId: curator!.id,
        slug: mixSlug,
        name: 'Mix',
        isPublic: true,
        collaborative: true,
      },
    })
    await prisma.collectionItem.createMany({
      data: [
        { collectionId: mix.id, soundId: kept.id, position: 1 },
        { collectionId: mix.id, soundId: hidden.id, position: 2 },
      ],
    })
    await prisma.collection.create({
      data: { userId: suspended!.id, slug: ownSlug, name: 'Own', isPublic: true },
    })
    await prisma.user.update({ where: { id: suspended!.id }, data: { suspendedAt: new Date() } })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('drops a suspended artist’s track from someone else’s public playlist', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/collections/${mixSlug}` })
    expect(res.statusCode).toBe(200)
    const titles = (res.json().items as Array<{ sound: { title: string } }>).map(
      (i) => i.sound.title,
    )
    expect(titles).toEqual([`${PREFIX}kept`])
  })

  it('keeps it out of the playlist feed and the embed', async () => {
    const rss = await app.inject({ method: 'GET', url: `/api/v1/collections/${mixSlug}/rss.xml` })
    expect(rss.body).toContain(`${PREFIX}kept`)
    expect(rss.body).not.toContain(`${PREFIX}hidden`)

    const embed = await app.inject({
      method: 'GET',
      url: `/api/v1/embed/col/${mixSlug}/tracks/${suspendedSoundId}/play`,
    })
    expect(embed.statusCode).toBe(404)
  })

  it('does not offer it in the track picker or take it as an add', async () => {
    const search = await app.inject({
      method: 'GET',
      url: `/api/v1/search/tracks?q=${PREFIX}`,
    })
    const titles = (search.json().tracks as Array<{ title: string }>).map((t) => t.title)
    expect(titles).toEqual([`${PREFIX}kept`])

    await prisma.collectionItem.deleteMany({ where: { soundId: suspendedSoundId } })
    const add = await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${mixSlug}/items`,
      headers: { cookie: guestCookie },
      payload: { soundId: suspendedSoundId },
    })
    expect(add.statusCode).toBe(400)
  })

  it('closes a suspended owner’s own collection', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/collections/${ownSlug}` })
    expect(res.statusCode).toBe(404)
  })
})
