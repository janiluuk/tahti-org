// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
} from '../../test/helpers.js'

const PREFIX = 'collection-unlisted-'
const UNLISTED = 'collection-unlisted-mix'
const DRAFT = 'collection-unlisted-draft'

describe('unlisted collections open by link', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await prisma.collection.deleteMany({ where: { slug: { in: [UNLISTED, DRAFT] } } })
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'collection-unlisted',
      tier: 'ARTIST',
    })
    const sound = await createReadySound(prisma, artist.channel!.id, 'For friends only')
    for (const [slug, visibility] of [
      [UNLISTED, 'UNLISTED'],
      [DRAFT, 'DRAFT'],
    ] as const) {
      await prisma.collection.create({
        data: {
          userId: artist.id,
          slug,
          name: slug,
          isPublic: false,
          visibility,
          items: { create: [{ position: 1, soundId: sound.id }] },
        },
      })
    }
  })

  afterAll(async () => {
    await prisma.collection.deleteMany({ where: { slug: { in: [UNLISTED, DRAFT] } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('serves an unlisted collection on its page, feed and embed', async () => {
    const page = await app.inject({ method: 'GET', url: `/api/v1/collections/${UNLISTED}` })
    expect(page.statusCode).toBe(200)
    const rss = await app.inject({ method: 'GET', url: `/api/v1/collections/${UNLISTED}/rss.xml` })
    expect(rss.statusCode).toBe(200)
    const embed = await app.inject({ method: 'GET', url: `/api/v1/embed/col/${UNLISTED}` })
    expect(embed.statusCode).toBe(200)
  })

  it('keeps a draft collection closed', async () => {
    const page = await app.inject({ method: 'GET', url: `/api/v1/collections/${DRAFT}` })
    expect(page.statusCode).toBe(404)
    const embed = await app.inject({ method: 'GET', url: `/api/v1/embed/col/${DRAFT}` })
    expect(embed.statusCode).toBe(404)
  })

  it('keeps the unlisted collection off the artist profile', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/u/collection-unlisted/profile' })
    expect(res.statusCode).toBe(200)
    const slugs = (res.json().collections as Array<{ slug: string }>).map((c) => c.slug)
    expect(slugs).not.toContain(UNLISTED)
  })
})
