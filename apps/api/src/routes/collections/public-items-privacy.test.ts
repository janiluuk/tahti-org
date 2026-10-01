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

const PREFIX = 'collection-privacy-'
const SLUG = 'collection-privacy-mix'

describe('public collection surfaces hide private entries', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let publicId: string
  let privateId: string
  let pendingId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await prisma.collection.deleteMany({ where: { slug: SLUG } })
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'collection-privacy',
    })
    const channelId = artist.channel!.id
    publicId = (await createReadySound(prisma, channelId, 'Released single')).id
    const priv = await createReadySound(prisma, channelId, 'Secret demo')
    await prisma.sound.update({ where: { id: priv.id }, data: { isPublic: false } })
    privateId = priv.id
    const pending = await createReadySound(prisma, channelId, 'Still rendering')
    await prisma.sound.update({ where: { id: pending.id }, data: { status: 'PROCESSING' } })
    pendingId = pending.id
    const release = (state: 'DRAFT' | 'PUBLISHED', title: string) =>
      prisma.release.create({
        data: {
          userId: artist.id,
          title,
          type: 'SINGLE',
          releaseDate: new Date('2030-01-01'),
          smartLinkSlug: `${PREFIX}${state.toLowerCase()}`,
          state,
        },
      })
    const draft = await release('DRAFT', 'Unannounced EP')
    const published = await release('PUBLISHED', 'Out now EP')
    await prisma.collection.create({
      data: {
        userId: artist.id,
        slug: SLUG,
        name: 'Mixed bag',
        isPublic: true,
        items: {
          create: [
            { position: 1, soundId: publicId },
            { position: 2, soundId: privateId },
            { position: 3, soundId: pendingId },
            { position: 4, releaseId: draft.id },
            { position: 5, releaseId: published.id },
          ],
        },
      },
    })
  })

  afterAll(async () => {
    await prisma.collection.deleteMany({ where: { slug: SLUG } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('the collection page lists only public, finished tracks and published releases', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/collections/${SLUG}` })
    expect(res.statusCode).toBe(200)
    const titles = res
      .json()
      .items.map(
        (i: { sound?: { title: string }; release?: { title: string } }) =>
          i.sound?.title ?? i.release?.title,
      )
    expect(titles).toEqual(['Released single', 'Out now EP'])
  })

  it('the RSS feed leaves the private entries out', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/collections/${SLUG}/rss.xml` })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('Released single')
    expect(res.body).not.toContain('Secret demo')
    expect(res.body).not.toContain('Still rendering')
    expect(res.body).not.toContain('Unannounced EP')
  })

  it('the embed lists and plays only public tracks', async () => {
    const embed = await app.inject({ method: 'GET', url: `/api/v1/embed/col/${SLUG}` })
    expect(embed.json().tracks.map((t: { id: string }) => t.id)).toEqual([publicId])

    const play = await app.inject({
      method: 'GET',
      url: `/api/v1/embed/col/${SLUG}/tracks/${privateId}/play`,
    })
    expect(play.statusCode).toBe(404)
  })
})
