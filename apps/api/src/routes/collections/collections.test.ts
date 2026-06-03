// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

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
    expect(rss.body).toContain('http://localhost:9000/tahti/mp3/')
  })

  it('adds a published release to a collection', async () => {
    const createRel = await app.inject({
      method: 'POST',
      url: '/api/me/releases',
      headers: { cookie },
      payload: {
        title: 'Collection EP',
        type: 'EP',
        releaseDate: '2026-04-01',
        tracks: [{ title: 'One', durationSec: 200 }],
      },
    })
    expect(createRel.statusCode).toBe(201)
    const releaseId = createRel.json().id
    await app.inject({
      method: 'PATCH',
      url: `/api/me/releases/${releaseId}`,
      headers: { cookie },
      payload: { state: 'PUBLISHED', smartLinkSlug: 'collection-ep-test' },
    })

    const relSlug = `${username}-with-release`
    await app.inject({
      method: 'POST',
      url: '/api/me/collections',
      headers: { cookie },
      payload: { name: 'With Release', slug: relSlug },
    })
    const add = await app.inject({
      method: 'POST',
      url: `/api/me/collections/${relSlug}/items`,
      headers: { cookie },
      payload: { releaseId },
    })
    expect(add.statusCode).toBe(201)

    const pub = await app.inject({
      method: 'GET',
      url: `/api/v1/collections/${relSlug}`,
    })
    expect(pub.json().items[0].release.title).toBe('Collection EP')
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

  it('rejects invalid collection type and duplicate slug', async () => {
    const badType = await app.inject({
      method: 'POST',
      url: '/api/me/collections',
      headers: { cookie },
      payload: { name: 'Bad', type: 'NOT_A_KIND' },
    })
    expect(badType.statusCode).toBe(400)

    const dupSlug = `${username}-dup-test`
    const first = await app.inject({
      method: 'POST',
      url: '/api/me/collections',
      headers: { cookie },
      payload: { name: 'First', slug: dupSlug },
    })
    expect(first.statusCode).toBe(201)

    const second = await app.inject({
      method: 'POST',
      url: '/api/me/collections',
      headers: { cookie },
      payload: { name: 'Second', slug: dupSlug },
    })
    expect(second.statusCode).toBe(409)

    await app.inject({
      method: 'DELETE',
      url: `/api/me/collections/${dupSlug}`,
      headers: { cookie },
    })
  })

  it('reorders collection items via PUT /reorder', async () => {
    const item2 = await createReadyArchiveItem(prisma, channelId, 'Dawn Mix')
    const create2 = await app.inject({
      method: 'POST',
      url: `/api/me/collections/${collectionSlug}/items`,
      headers: { cookie },
      payload: { archiveItemId: item2.id },
    })
    expect(create2.statusCode).toBe(201)

    const withItems = await app.inject({
      method: 'GET',
      url: '/api/me/collections?expand=items',
      headers: { cookie },
    })
    const col = withItems.json().find((c: { slug: string }) => c.slug === collectionSlug)
    const sorted = [...col.items].sort(
      (a: { position: number }, b: { position: number }) => a.position - b.position,
    )
    const reversed = [...sorted].reverse().map((i: { id: string }) => i.id)

    const reorder = await app.inject({
      method: 'PUT',
      url: `/api/me/collections/${collectionSlug}/reorder`,
      headers: { cookie },
      payload: { itemIds: reversed },
    })
    expect(reorder.statusCode).toBe(200)
    expect(reorder.json().items[0].id).toBe(reversed[0])
  })

  it('marks a collection as featured via PATCH', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/me/collections/${collectionSlug}`,
      headers: { cookie },
      payload: { isFeatured: true },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().isFeatured).toBe(true)

    const profile = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${username}/profile`,
    })
    const featured = profile
      .json()
      .collections.find((c: { slug: string; isFeatured: boolean }) => c.slug === collectionSlug)
    expect(featured?.isFeatured).toBe(true)
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
