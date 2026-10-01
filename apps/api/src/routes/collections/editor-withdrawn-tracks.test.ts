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

const PREFIX = 'collection-withdrawn-'
const SLUG = 'collection-withdrawn-picks'

describe("collection editor and another artist's withdrawn track", () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let ownId: string
  let theirsId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await prisma.collection.deleteMany({ where: { slug: SLUG } })
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: 'collection-withdrawn-owner',
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'collection-withdrawn-other',
    })
    cookie = await sessionCookieFor(prisma, owner.id)
    const own = await createReadySound(prisma, owner.channel!.id, 'My private demo')
    await prisma.sound.update({ where: { id: own.id }, data: { isPublic: false } })
    ownId = own.id
    const theirs = await createReadySound(prisma, other.channel!.id, 'Their withdrawn track')
    theirsId = theirs.id
    await prisma.collection.create({
      data: {
        userId: owner.id,
        slug: SLUG,
        name: 'Picks',
        isPublic: true,
        items: {
          create: [
            { position: 1, soundId: ownId },
            { position: 2, soundId: theirsId },
          ],
        },
      },
    })
    await prisma.sound.update({ where: { id: theirsId }, data: { isPublic: false } })
  })

  afterAll(async () => {
    await prisma.collection.deleteMany({ where: { slug: SLUG } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it("still plays the owner's own private track but not another artist's", async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/collections/${SLUG}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const items = res.json().items as Array<{
      sound: { id: string }
      audioUrl: string | null
      unavailable?: boolean
    }>
    const own = items.find((i) => i.sound.id === ownId)!
    const theirs = items.find((i) => i.sound.id === theirsId)!
    expect(own.audioUrl).toBeTruthy()
    expect(theirs.audioUrl).toBeNull()
    expect(theirs.unavailable).toBe(true)
  })

  it("names each track's artist, never by an email address", async () => {
    await prisma.user.update({
      where: { username: 'collection-withdrawn-other' },
      data: { displayName: 'other@example.com' },
    })
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/collections/${SLUG}`,
      headers: { cookie },
    })
    const items = res.json().items as Array<{
      sound: { id: string; artist: { username: string; displayName: string }; channel: object }
    }>
    expect(items.find((i) => i.sound.id === theirsId)!.sound.artist).toEqual({
      username: 'collection-withdrawn-other',
      displayName: 'collection-withdrawn-other',
    })
    expect(items.find((i) => i.sound.id === ownId)!.sound.artist.username).toBe(
      'collection-withdrawn-owner',
    )
    expect(JSON.stringify(res.json())).not.toContain('other@example.com')
  })
})
