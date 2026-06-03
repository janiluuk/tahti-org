// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { publicMediaUrl } from '../../lib/public-media-url.js'

const VALID_TYPES = ['MIX_SERIES', 'ALBUM', 'CUSTOM'] as const

const collectionItemInclude = {
  archiveItem: {
    select: {
      id: true,
      title: true,
      durationSec: true,
      mp3Key: true,
      bannerUrl: true,
      description: true,
      createdAt: true,
    },
  },
  release: {
    select: {
      id: true,
      title: true,
      type: true,
      smartLinkSlug: true,
      releaseDate: true,
      artworkUrl: true,
      description: true,
    },
  },
} as const

// M23 — Collections: named groupings of archive items / releases
const collectionRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Artist-facing management ─────────────────────────────────────────────

  fastify.get('/api/me/collections', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const expand = (request.query as { expand?: string }).expand === 'items'
    const cols = await fastify.prisma.collection.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: expand
        ? { items: { orderBy: { position: 'asc' }, include: collectionItemInclude } }
        : { _count: { select: { items: true } } },
    })
    return reply.send(cols)
  })

  fastify.post('/api/me/collections', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const body = request.body as {
      name?: string
      slug?: string
      description?: string
      type?: string
      isPublic?: boolean
      coverUrl?: string
    }

    const name = body.name?.trim()
    if (!name) return reply.status(400).send({ error: 'name is required' })

    const slug =
      body.slug
        ?.trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-') ??
      `${user.username}-${name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 30)}`

    const type = (body.type?.toUpperCase() ?? 'CUSTOM') as (typeof VALID_TYPES)[number]
    if (!VALID_TYPES.includes(type)) {
      return reply.status(400).send({ error: 'Invalid type' })
    }

    const existing = await fastify.prisma.collection.findUnique({ where: { slug } })
    if (existing) return reply.status(409).send({ error: 'Slug already taken' })

    const col = await fastify.prisma.collection.create({
      data: {
        userId: user.id,
        slug,
        name,
        description: body.description?.trim() || null,
        type,
        isPublic: body.isPublic ?? true,
        coverUrl: body.coverUrl?.trim() || null,
      },
    })
    return reply.status(201).send(col)
  })

  fastify.patch(
    '/api/me/collections/:slug',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { slug } = request.params as { slug: string }
      const body = request.body as {
        name?: string
        description?: string
        isPublic?: boolean
        coverUrl?: string
      }

      const col = await fastify.prisma.collection.findFirst({
        where: { slug, userId: user.id },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: Record<string, any> = {}
      if (body.name !== undefined) data.name = body.name.trim().slice(0, 100)
      if (body.description !== undefined) data.description = body.description.slice(0, 1000) || null
      if (body.isPublic !== undefined) data.isPublic = body.isPublic
      if (body.coverUrl !== undefined) data.coverUrl = body.coverUrl.trim() || null

      const updated = await fastify.prisma.collection.update({ where: { id: col.id }, data })
      return reply.send(updated)
    },
  )

  fastify.delete(
    '/api/me/collections/:slug',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { slug } = request.params as { slug: string }

      const col = await fastify.prisma.collection.findFirst({
        where: { slug, userId: user.id },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })
      await fastify.prisma.collection.delete({ where: { id: col.id } })
      return reply.status(204).send()
    },
  )

  // POST /api/me/collections/:slug/items — add archive item or release
  fastify.post(
    '/api/me/collections/:slug/items',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { slug } = request.params as { slug: string }
      const body = request.body as { archiveItemId?: string; releaseId?: string; position?: number }

      const col = await fastify.prisma.collection.findFirst({
        where: { slug, userId: user.id },
        include: { _count: { select: { items: true } } },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      if (!body.archiveItemId && !body.releaseId) {
        return reply.status(400).send({ error: 'archiveItemId or releaseId is required' })
      }
      if (body.archiveItemId && body.releaseId) {
        return reply.status(400).send({ error: 'Provide archiveItemId or releaseId, not both' })
      }

      if (body.archiveItemId) {
        const archive = await fastify.prisma.archiveItem.findFirst({
          where: {
            id: body.archiveItemId,
            status: 'READY',
            channel: { userId: user.id },
          },
        })
        if (!archive) return reply.status(400).send({ error: 'Archive item not found' })
      }

      if (body.releaseId) {
        const release = await fastify.prisma.release.findFirst({
          where: { id: body.releaseId, userId: user.id, state: 'PUBLISHED' },
        })
        if (!release) return reply.status(400).send({ error: 'Published release not found' })
      }

      const position = body.position ?? col._count.items + 1

      // Shift existing items to make room
      await fastify.prisma.collectionItem.updateMany({
        where: { collectionId: col.id, position: { gte: position } },
        data: { position: { increment: 1 } },
      })

      const item = await fastify.prisma.collectionItem.create({
        data: {
          collectionId: col.id,
          archiveItemId: body.archiveItemId ?? null,
          releaseId: body.releaseId ?? null,
          position,
        },
      })
      return reply.status(201).send(item)
    },
  )

  // PUT /api/me/collections/:slug/reorder — M23 drag reorder
  fastify.put(
    '/api/me/collections/:slug/reorder',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { slug } = request.params as { slug: string }
      const body = request.body as { itemIds?: string[] }

      const itemIds = body.itemIds
      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return reply.status(400).send({ error: 'itemIds array is required' })
      }

      const col = await fastify.prisma.collection.findFirst({
        where: { slug, userId: user.id },
        include: { items: { select: { id: true } } },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      const existing = new Set(col.items.map((i) => i.id))
      if (itemIds.length !== existing.size || itemIds.some((id) => !existing.has(id))) {
        return reply.status(400).send({ error: 'itemIds must match collection items exactly' })
      }

      // Two-phase update avoids @@unique([collectionId, position]) collisions while swapping.
      await fastify.prisma.$transaction(async (tx) => {
        for (let i = 0; i < itemIds.length; i++) {
          await tx.collectionItem.update({
            where: { id: itemIds[i] },
            data: { position: -(i + 1) },
          })
        }
        for (let i = 0; i < itemIds.length; i++) {
          await tx.collectionItem.update({
            where: { id: itemIds[i] },
            data: { position: i + 1 },
          })
        }
      })

      const items = await fastify.prisma.collectionItem.findMany({
        where: { collectionId: col.id },
        orderBy: { position: 'asc' },
        include: collectionItemInclude,
      })
      return reply.send({ items })
    },
  )

  // DELETE /api/me/collections/:slug/items/:itemId
  fastify.delete(
    '/api/me/collections/:slug/items/:itemId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { slug, itemId } = request.params as { slug: string; itemId: string }

      const col = await fastify.prisma.collection.findFirst({
        where: { slug, userId: user.id },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      await fastify.prisma.collectionItem.deleteMany({
        where: { id: itemId, collectionId: col.id },
      })
      return reply.status(204).send()
    },
  )

  // ── Public endpoints ────────────────────────────────────────────────────

  fastify.get('/api/v1/collections/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const col = await fastify.prisma.collection.findFirst({
      where: { slug, isPublic: true },
      include: {
        user: { select: { username: true, displayName: true } },
        items: {
          orderBy: { position: 'asc' },
          include: collectionItemInclude,
        },
      },
    })
    if (!col) return reply.status(404).send({ error: 'Collection not found' })
    return reply.send({
      ...col,
      links: {
        page: `${config.appUrl}/u/${col.user.username}/c/${col.slug}`,
        rss: `${config.apiUrl}/api/v1/collections/${col.slug}/rss.xml`,
      },
    })
  })

  // GET /api/v1/collections/:slug/rss.xml — collection RSS feed
  fastify.get('/api/v1/collections/:slug/rss.xml', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const col = await fastify.prisma.collection.findFirst({
      where: { slug, isPublic: true },
      include: {
        user: { select: { username: true, displayName: true } },
        items: {
          orderBy: { position: 'asc' },
          include: collectionItemInclude,
        },
      },
    })
    if (!col) return reply.status(404).send({ error: 'Collection not found' })

    const xml = buildRss({
      title: col.name,
      description: col.description ?? `${col.name} by ${col.user.displayName}`,
      link: `${config.appUrl}/u/${col.user.username}/c/${col.slug}`,
      items: collectionRssItems(col.items, col.user.username),
    })

    return reply.header('Content-Type', 'application/rss+xml; charset=utf-8').send(xml)
  })

  // GET /api/v1/c/:slug/rss.xml — channel archive RSS feed
  fastify.get('/api/v1/c/:slug/rss.xml', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const channel = await fastify.prisma.channel.findUnique({
      where: { slug },
      select: {
        slug: true,
        user: { select: { username: true, displayName: true, bio: true } },
        archiveItems: {
          where: { status: 'READY', isPublic: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            title: true,
            description: true,
            durationSec: true,
            mp3Key: true,
            createdAt: true,
          },
        },
      },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    const xml = buildRss({
      title: `${channel.user.displayName} — Tahti`,
      description: channel.user.bio ?? `${channel.user.displayName} on Tahti`,
      link: `${config.appUrl}/u/${channel.user.username}`,
      items: channel.archiveItems.map((i) => ({
        title: i.title,
        description: i.description ?? '',
        pubDate: i.createdAt,
        duration: i.durationSec ?? 0,
        enclosureUrl: publicMediaUrl(i.mp3Key),
        guid: `${config.appUrl}/c/${channel.slug}#${i.id}`,
      })),
    })

    return reply.header('Content-Type', 'application/rss+xml; charset=utf-8').send(xml)
  })
}

interface RssItem {
  title: string
  description: string
  pubDate: Date
  duration: number
  enclosureUrl: string | null
  guid: string
}

type CollectionItemRow = {
  archiveItem: {
    id: string
    title: string
    description: string | null
    durationSec: number | null
    mp3Key: string | null
    createdAt: Date
  } | null
  release: {
    title: string
    description: string | null
    smartLinkSlug: string
    releaseDate: Date
  } | null
}

function collectionRssItems(items: CollectionItemRow[], username: string): RssItem[] {
  const out: RssItem[] = []
  for (const i of items) {
    if (i.archiveItem) {
      out.push({
        title: i.archiveItem.title,
        description: i.archiveItem.description ?? '',
        pubDate: i.archiveItem.createdAt,
        duration: i.archiveItem.durationSec ?? 0,
        enclosureUrl: publicMediaUrl(i.archiveItem.mp3Key),
        guid: `${config.appUrl}/u/${username}/c/item/${i.archiveItem.id}`,
      })
    } else if (i.release) {
      out.push({
        title: i.release.title,
        description: i.release.description ?? '',
        pubDate: i.release.releaseDate,
        duration: 0,
        enclosureUrl: null,
        guid: `${config.appUrl}/r/${i.release.smartLinkSlug}`,
      })
    }
  }
  return out
}

function buildRss(opts: {
  title: string
  description: string
  link: string
  items: RssItem[]
}): string {
  const items = opts.items
    .map((i) => {
      const enclosure = i.enclosureUrl
        ? `<enclosure url="${escXml(i.enclosureUrl)}" type="audio/mpeg" length="0"/>`
        : ''
      const mins = Math.floor(i.duration / 60)
      const secs = i.duration % 60
      const dur = `${mins}:${String(secs).padStart(2, '0')}`
      return `
    <item>
      <title>${escXml(i.title)}</title>
      <description>${escXml(i.description)}</description>
      <pubDate>${i.pubDate.toUTCString()}</pubDate>
      <guid isPermaLink="true">${escXml(i.guid)}</guid>
      <itunes:duration>${dur}</itunes:duration>
      ${enclosure}
    </item>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escXml(opts.title)}</title>
    <description>${escXml(opts.description)}</description>
    <link>${escXml(opts.link)}</link>
    <language>fi</language>
    <generator>Tahti ry — https://tahti.live</generator>
    ${items}
  </channel>
</rss>`
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default collectionRoutes
