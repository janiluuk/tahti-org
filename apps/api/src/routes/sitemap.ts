// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { config } from '../config.js'
import { resolveArtistUrl } from '../lib/artist-url.js'

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function urlEntry(loc: string, lastmod?: Date): string {
  const lastmodTag = lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ''
  return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    ${lastmodTag}\n  </url>`
}

function wrapUrlset(entries: string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
  ].join('\n')
}

const listedAccount = { deletedAt: null, suspendedAt: null }

/** Phase 8 — SEO sitemaps for profiles, published releases, public tracks
 * and public collections. Suspended and deleted accounts stay out. */
const sitemapRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/sitemap/profiles.xml', async (_request, reply) => {
    const users = await fastify.prisma.user.findMany({
      where: {
        ...listedAccount,
        OR: [
          { releases: { some: { state: 'PUBLISHED' } } },
          { channel: { sounds: { some: { isPublic: true, status: 'READY' } } } },
        ],
      },
      select: { username: true, updatedAt: true },
      orderBy: { username: 'asc' },
      take: 10_000,
    })

    const body = wrapUrlset(users.map((u) => urlEntry(resolveArtistUrl(u.username), u.updatedAt)))

    return reply.type('application/xml').send(body)
  })

  fastify.get('/api/sitemap/releases.xml', async (_request, reply) => {
    const releases = await fastify.prisma.release.findMany({
      where: { state: 'PUBLISHED' },
      select: { smartLinkSlug: true, publishedAt: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 50_000,
    })

    const base = config.appUrl.replace(/\/$/, '')
    const body = wrapUrlset(
      releases.map((r) => urlEntry(`${base}/r/${r.smartLinkSlug}`, r.publishedAt ?? r.updatedAt)),
    )

    return reply.type('application/xml').send(body)
  })

  fastify.get('/api/sitemap/tracks.xml', async (_request, reply) => {
    const tracks = await fastify.prisma.sound.findMany({
      where: { isPublic: true, status: 'READY', channel: { user: listedAccount } },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 50_000,
    })

    const base = config.appUrl.replace(/\/$/, '')
    const body = wrapUrlset(tracks.map((t) => urlEntry(`${base}/t/${t.id}`, t.updatedAt)))

    return reply.type('application/xml').send(body)
  })

  fastify.get('/api/sitemap/collections.xml', async (_request, reply) => {
    const collections = await fastify.prisma.collection.findMany({
      where: { isPublic: true, visibility: 'PUBLIC', user: listedAccount },
      select: { slug: true, updatedAt: true, user: { select: { username: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 50_000,
    })

    const base = config.appUrl.replace(/\/$/, '')
    const body = wrapUrlset(
      collections.map((c) => urlEntry(`${base}/u/${c.user.username}/c/${c.slug}`, c.updatedAt)),
    )

    return reply.type('application/xml').send(body)
  })
}

export default sitemapRoutes
