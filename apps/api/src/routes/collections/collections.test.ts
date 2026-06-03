// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadyArchiveItem,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'collection-test-'

describe('M23 — collections and RSS', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let username: string
  let channelId: string
  let archiveItemId: string
  let collectionSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    username = 'collection-test-artist'
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98500,
    })
    channelId = artist.channel!.id
    cookie = await sessionCookieFor(prisma, artist.id)

    const item = await createReadyArchiveItem(prisma, channelId, 'Sunset Mix')
    archiveItemId = item.id
    collectionSlug = `${username}-trance-sets`
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('creates a collection, adds archive item, and serves public JSON + RSS', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/collections',
      headers: { cookie },
      payload: {
        name: 'Trance Sets',
        slug: collectionSlug,
        type: 'MIX_SERIES',
        description: 'Weekly mixes',
      },
    })
    expect(create.statusCode).toBe(201)
    expect(create.json().slug).toBe(collectionSlug)

    const add = await app.inject({
      method: 'POST',
      url: `/api/me/collections/${collectionSlug}/items`,
      headers: { cookie },
      payload: { archiveItemId, position: 1 },
    })
    expect(add.statusCode).toBe(201)

    const pub = await app.inject({
      method: 'GET',
      url: `/api/v1/collections/${collectionSlug}`,
    })
    expect(pub.statusCode).toBe(200)
    expect(pub.json().name).toBe('Trance Sets')
    expect(pub.json().items).toHaveLength(1)
    expect(pub.json().items[0].archiveItem.title).toBe('Sunset Mix')

    const rss = await app.inject({
      method: 'GET',
      url: `/api/v1/collections/${collectionSlug}/rss.xml`,
    })
    expect(rss.statusCode).toBe(200)
    expect(rss.headers['content-type']).toContain('application/rss+xml')
    expect(rss.body).toContain('<rss')
    expect(rss.body).toContain('Sunset Mix')
    expect(rss.body).toContain('<itunes:duration>')
  })

  it('hides private collections from public API', async () => {
    const privateSlug = `${username}-private-vault`
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/collections',
      headers: { cookie },
      payload: { name: 'Private Vault', slug: privateSlug, isPublic: false },
    })
    expect(create.statusCode).toBe(201)

    const pub = await app.inject({
      method: 'GET',
      url: `/api/v1/collections/${privateSlug}`,
    })
    expect(pub.statusCode).toBe(404)
  })

  it('serves channel archive RSS for public ready items', async () => {
    const rss = await app.inject({
      method: 'GET',
      url: `/api/v1/c/${username}/rss.xml`,
    })
    expect(rss.statusCode).toBe(200)
    expect(rss.body).toContain('Sunset Mix')
  })

  it('removes collection items and deletes the collection', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/me/collections',
      headers: { cookie },
    })
    expect(list.statusCode).toBe(200)
    const col = list.json().find((c: { slug: string }) => c.slug === collectionSlug)
    expect(col).toBeTruthy()

    const items = await prisma.collectionItem.findMany({
      where: { collection: { slug: collectionSlug } },
    })
    const delItem = await app.inject({
      method: 'DELETE',
      url: `/api/me/collections/${collectionSlug}/items/${items[0]!.id}`,
      headers: { cookie },
    })
    expect(delItem.statusCode).toBe(204)

    const delCol = await app.inject({
      method: 'DELETE',
      url: `/api/me/collections/${collectionSlug}`,
      headers: { cookie },
    })
    expect(delCol.statusCode).toBe(204)
  })
})
