// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'set-membership-'

type Entry = {
  id: string
  slug: string
  name: string
  coverUrl: string | null
  style: string
  isPublic: boolean
  visibility: string
  itemCount: number
  member: boolean
  itemId: string | null
}

describe('GET /api/me/sound/:id/set-membership', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let otherCookie: string
  let soundId: string
  let privateSoundId: string
  let inSlug: string
  let outSlug: string
  let itemId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    otherCookie = await sessionCookieFor(prisma, other.id)

    const sound = await createReadySound(prisma, owner.channel!.id, 'Set member')
    await prisma.sound.update({ where: { id: sound.id }, data: { isPublic: true } })
    soundId = sound.id
    const hidden = await createReadySound(prisma, other.channel!.id, 'Hidden track')
    await prisma.sound.update({ where: { id: hidden.id }, data: { isPublic: false } })
    privateSoundId = hidden.id

    inSlug = `${PREFIX}in`
    outSlug = `${PREFIX}out`
    const inCol = await prisma.collection.create({
      data: {
        userId: owner.id,
        slug: inSlug,
        name: 'In set',
        style: 'DJ_SET_SERIES',
        visibility: 'UNLISTED',
        isPublic: false,
        items: { create: [{ position: 1, soundId: sound.id }] },
      },
      include: { items: true },
    })
    itemId = inCol.items[0]!.id
    await prisma.collection.create({
      data: { userId: owner.id, slug: outSlug, name: 'Out set', style: 'PLAYLIST' },
    })
    await prisma.collection.create({
      data: { userId: other.id, slug: `${PREFIX}foreign`, name: 'Not mine' },
    })
    const groupCol = await prisma.collection.create({
      data: {
        userId: owner.id,
        slug: `${PREFIX}group-playlist`,
        name: 'Group playlist',
        artistGroup: {
          create: {
            slug: `${PREFIX}group`,
            name: 'Group',
            createdByUserId: owner.id,
            members: { create: { userId: owner.id, role: 'OWNER' } },
          },
        },
      },
    })
    expect(groupCol.id).toBeTruthy()
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires a session', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/me/sound/${soundId}/set-membership` })
    expect(res.statusCode).toBe(401)
  })

  it("lists only the caller's own collections with member and itemId", async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${soundId}/set-membership`,
      headers: { cookie: ownerCookie },
    })
    expect(res.statusCode).toBe(200)
    const entries = res.json() as Entry[]
    expect(entries.map((e) => e.slug).sort()).toEqual([inSlug, outSlug].sort())

    const inEntry = entries.find((e) => e.slug === inSlug)!
    expect(inEntry).toMatchObject({
      name: 'In set',
      style: 'DJ_SET_SERIES',
      isPublic: false,
      visibility: 'UNLISTED',
      itemCount: 1,
      member: true,
      itemId,
    })
    expect(Object.keys(inEntry).sort()).toEqual(
      [
        'coverUrl',
        'id',
        'isPublic',
        'itemCount',
        'itemId',
        'member',
        'name',
        'slug',
        'style',
        'visibility',
      ].sort(),
    )

    const outEntry = entries.find((e) => e.slug === outSlug)!
    expect(outEntry).toMatchObject({ itemCount: 0, member: false, itemId: null })
  })

  it('leaves group playlists out (their adds follow the group rules)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${soundId}/set-membership`,
      headers: { cookie: ownerCookie },
    })
    const slugs = (res.json() as Entry[]).map((e) => e.slug)
    expect(slugs).not.toContain(`${PREFIX}group-playlist`)
  })

  it('flips to member after the existing add route and back after delete', async () => {
    const add = await app.inject({
      method: 'POST',
      url: `/api/me/collections/${outSlug}/items`,
      headers: { cookie: ownerCookie },
      payload: { soundId },
    })
    expect(add.statusCode).toBe(201)
    const created = add.json() as { id: string }

    const after = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${soundId}/set-membership`,
      headers: { cookie: ownerCookie },
    })
    const entry = (after.json() as Entry[]).find((e) => e.slug === outSlug)!
    expect(entry).toMatchObject({ member: true, itemId: created.id, itemCount: 1 })

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/me/collections/${outSlug}/items/${created.id}`,
      headers: { cookie: ownerCookie },
    })
    expect(del.statusCode).toBe(204)
    const back = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${soundId}/set-membership`,
      headers: { cookie: ownerCookie },
    })
    expect((back.json() as Entry[]).find((e) => e.slug === outSlug)).toMatchObject({
      member: false,
      itemId: null,
    })
  })

  it("answers for another artist's public track, but not their private one", async () => {
    const pub = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${soundId}/set-membership`,
      headers: { cookie: otherCookie },
    })
    expect(pub.statusCode).toBe(200)
    const entries = pub.json() as Entry[]
    expect(entries.map((e) => e.slug)).toEqual([`${PREFIX}foreign`])
    expect(entries[0]!.member).toBe(false)

    const priv = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${privateSoundId}/set-membership`,
      headers: { cookie: ownerCookie },
    })
    expect(priv.statusCode).toBe(404)
  })

  it('404s for an unknown sound', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/sound/does-not-exist/set-membership',
      headers: { cookie: ownerCookie },
    })
    expect(res.statusCode).toBe(404)
  })
})
