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

  it('rejects invalid collections list query', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/collections?expand=nope',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects invalid collection create body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/collections',
      headers: { cookie },
      payload: { name: '' },
    })
    expect(res.statusCode).toBe(400)
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

  it('serves artist archive RSS at /api/v1/u/:username/rss.xml', async () => {
    const rss = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${username}/rss.xml`,
    })
    expect(rss.statusCode).toBe(200)
    expect(rss.headers['content-type']).toContain('rss+xml')
    expect(rss.body).toContain('Sunset Mix')
    expect(rss.body).toContain('<enclosure')
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

  it('updates collection cover URL via PATCH', async () => {
    const cover = 'https://cdn.example.com/collection-cover.jpg'
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/me/collections/${collectionSlug}`,
      headers: { cookie },
      payload: { coverUrl: cover },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().coverUrl).toBe(cover)

    const pub = await app.inject({
      method: 'GET',
      url: `/api/v1/collections/${collectionSlug}`,
    })
    expect(pub.statusCode).toBe(200)
    expect(pub.json().coverUrl).toBe(cover)
  })

  it('serves an uploaded cover via a presigned URL, not a bare public link', async () => {
    const uploadKey = `collections/${username}/${collectionSlug}/cover-test123.jpg`
    const complete = await app.inject({
      method: 'POST',
      url: `/api/me/collections/${collectionSlug}/cover/complete`,
      headers: { cookie },
      payload: { uploadKey },
    })
    expect(complete.statusCode).toBe(200)
    const { url: uploadedUrl } = complete.json()
    expect(uploadedUrl).toContain(uploadKey)
    // A presigned URL always carries AWS SigV4 query-string auth — a bare public
    // link would not. This is the actual guarantee this fix depends on: nobody can
    // fetch the object without this signature, unlike the old blanket bucket grant.
    expect(uploadedUrl).toMatch(/X-Amz-Signature=/)

    const owner = await app.inject({
      method: 'GET',
      url: `/api/me/collections/${collectionSlug}`,
      headers: { cookie },
    })
    expect(owner.statusCode).toBe(200)
    expect(owner.json().coverUrl).toMatch(/X-Amz-Signature=/)

    const pub = await app.inject({
      method: 'GET',
      url: `/api/v1/collections/${collectionSlug}`,
    })
    expect(pub.statusCode).toBe(200)
    expect(pub.json().coverUrl).toMatch(/X-Amz-Signature=/)
    // coverKey itself is allowed through by CollectionPublicViewSchema's
    // .passthrough() — harmless here: this route already 404s for any
    // non-public collection, and a bare key with no valid signature can't
    // fetch the object now that anonymous read is off.
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

describe('collaborative playlists', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let contributorCookie: string
  let contributorArchiveItemId: string
  let collaborativeSlug: string
  let nonCollaborativeSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}collab-owner@example.com`,
      username: `${PREFIX}collab-owner`,
      tier: 'ARTIST',
    })
    ownerCookie = await sessionCookieFor(prisma, owner.id)

    const contributor = await createTestArtist(prisma, {
      email: `${PREFIX}collab-contributor@example.com`,
      username: `${PREFIX}collab-contributor`,
      tier: 'ARTIST',
    })
    contributorCookie = await sessionCookieFor(prisma, contributor.id)
    const contributorItem = await createReadyArchiveItem(
      prisma,
      contributor.channel!.id,
      'Contributor track',
    )
    contributorArchiveItemId = contributorItem.id

    collaborativeSlug = `${PREFIX}collab-playlist`
    await prisma.collection.create({
      data: {
        userId: owner.id,
        slug: collaborativeSlug,
        name: 'Open playlist',
        style: 'PLAYLIST',
        isPublic: true,
        collaborative: true,
      },
    })

    nonCollaborativeSlug = `${PREFIX}closed-playlist`
    await prisma.collection.create({
      data: {
        userId: owner.id,
        slug: nonCollaborativeSlug,
        name: 'Closed playlist',
        style: 'PLAYLIST',
        isPublic: true,
        collaborative: false,
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET /api/v1/search/tracks finds a public catalog track by title', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/search/tracks?q=Contributor',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { tracks: Array<{ id: string; title: string }> }
    expect(body.tracks.map((t) => t.id)).toContain(contributorArchiveItemId)
  })

  it('lets another logged-in user add a track to a collaborative playlist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${collaborativeSlug}/items`,
      headers: { cookie: contributorCookie },
      payload: { archiveItemId: contributorArchiveItemId },
    })
    expect(res.statusCode).toBe(201)

    const item = await prisma.collectionItem.findFirst({
      where: { collection: { slug: collaborativeSlug }, archiveItemId: contributorArchiveItemId },
    })
    expect(item).toBeTruthy()
  })

  it('rejects adding the same track twice', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${collaborativeSlug}/items`,
      headers: { cookie: contributorCookie },
      payload: { archiveItemId: contributorArchiveItemId },
    })
    expect(res.statusCode).toBe(409)
  })

  it('requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${collaborativeSlug}/items`,
      payload: { archiveItemId: contributorArchiveItemId },
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects adding to a non-collaborative playlist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${nonCollaborativeSlug}/items`,
      headers: { cookie: contributorCookie },
      payload: { archiveItemId: contributorArchiveItemId },
    })
    expect(res.statusCode).toBe(404)
  })

  it('rejects a track that does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${collaborativeSlug}/items`,
      headers: { cookie: ownerCookie },
      payload: { archiveItemId: 'not-a-real-track' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('collection subscriptions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let subscriberCookie: string
  let otherCookie: string
  let publicSlug: string
  let privateSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}sub-owner@example.com`,
      username: `${PREFIX}sub-owner`,
      tier: 'ARTIST',
    })
    ownerCookie = await sessionCookieFor(prisma, owner.id)

    const subscriber = await createTestArtist(prisma, {
      email: `${PREFIX}sub-listener@example.com`,
      username: `${PREFIX}sub-listener`,
      tier: 'ARTIST',
    })
    subscriberCookie = await sessionCookieFor(prisma, subscriber.id)

    const other = await createTestArtist(prisma, {
      email: `${PREFIX}sub-other@example.com`,
      username: `${PREFIX}sub-other`,
      tier: 'ARTIST',
    })
    otherCookie = await sessionCookieFor(prisma, other.id)

    publicSlug = `${PREFIX}sub-public-playlist`
    await prisma.collection.create({
      data: { userId: owner.id, slug: publicSlug, name: 'Public playlist', isPublic: true },
    })

    privateSlug = `${PREFIX}sub-private-playlist`
    await prisma.collection.create({
      data: { userId: owner.id, slug: privateSlug, name: 'Private playlist', isPublic: false },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('reports subscribed: false with no session, no 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/collections/${publicSlug}/subscribe`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ subscribed: false, subscriberCount: 0 })
  })

  it('requires auth to subscribe', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${publicSlug}/subscribe`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('subscribes, reports subscribed: true, and is idempotent', async () => {
    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${publicSlug}/subscribe`,
      headers: { cookie: subscriberCookie },
    })
    expect(first.statusCode).toBe(200)
    expect(first.json()).toEqual({ subscribed: true, subscriberCount: 1 })

    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${publicSlug}/subscribe`,
      headers: { cookie: subscriberCookie },
    })
    expect(second.json()).toEqual({ subscribed: true, subscriberCount: 1 })

    const check = await app.inject({
      method: 'GET',
      url: `/api/v1/collections/${publicSlug}/subscribe`,
      headers: { cookie: subscriberCookie },
    })
    expect(check.json()).toEqual({ subscribed: true, subscriberCount: 1 })
  })

  it('counts multiple subscribers', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${publicSlug}/subscribe`,
      headers: { cookie: otherCookie },
    })
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/collections/${publicSlug}/subscribe`,
    })
    expect(res.json().subscriberCount).toBe(2)
  })

  it('unsubscribes', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/collections/${publicSlug}/subscribe`,
      headers: { cookie: subscriberCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ subscribed: false, subscriberCount: 1 })
  })

  it('404s subscribing to a private collection', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${privateSlug}/subscribe`,
      headers: { cookie: subscriberCookie },
    })
    expect(res.statusCode).toBe(404)
  })
})

// Player "Add to..." lets a listener save ANY public track (not just their own
// uploads) to one of their own collections via the owner-only items route.
describe('owner route accepts any public track (player "Add to...")', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let listenerCookie: string
  let listenerSlug: string
  let otherArtistPublicItemId: string
  let otherArtistPrivateItemId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const listener = await createTestArtist(prisma, {
      email: `${PREFIX}addto-listener@example.com`,
      username: `${PREFIX}addto-listener`,
      tier: 'ARTIST',
    })
    listenerCookie = await sessionCookieFor(prisma, listener.id)

    const otherArtist = await createTestArtist(prisma, {
      email: `${PREFIX}addto-other@example.com`,
      username: `${PREFIX}addto-other`,
      tier: 'ARTIST',
    })
    const publicItem = await createReadyArchiveItem(prisma, otherArtist.channel!.id, 'Public track')
    otherArtistPublicItemId = publicItem.id

    const privateItem = await createReadyArchiveItem(
      prisma,
      otherArtist.channel!.id,
      'Private track',
    )
    await prisma.archiveItem.update({ where: { id: privateItem.id }, data: { isPublic: false } })
    otherArtistPrivateItemId = privateItem.id

    listenerSlug = `${PREFIX}addto-my-playlist`
    await prisma.collection.create({
      data: { userId: listener.id, slug: listenerSlug, name: 'My playlist', style: 'PLAYLIST' },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it("lets the owner add another artist's public track to their own playlist", async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/collections/${listenerSlug}/items`,
      headers: { cookie: listenerCookie },
      payload: { archiveItemId: otherArtistPublicItemId },
    })
    expect(res.statusCode).toBe(201)
  })

  it('rejects adding the same track twice', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/collections/${listenerSlug}/items`,
      headers: { cookie: listenerCookie },
      payload: { archiveItemId: otherArtistPublicItemId },
    })
    expect(res.statusCode).toBe(409)
  })

  it("rejects another artist's private track", async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/collections/${listenerSlug}/items`,
      headers: { cookie: listenerCookie },
      payload: { archiveItemId: otherArtistPrivateItemId },
    })
    expect(res.statusCode).toBe(400)
  })
})
