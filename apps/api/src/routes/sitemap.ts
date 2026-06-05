// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { config } from '../config.js'

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

/** Phase 8 — SEO sitemaps for profiles and published releases. */
const sitemapRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/sitemap/profiles.xml', async (_request, reply) => {
    const users = await fastify.prisma.user.findMany({
      where: {
        releases: { some: { state: 'PUBLISHED' } },
      },
      select: { username: true, updatedAt: true },
      orderBy: { username: 'asc' },
      take: 10_000,
    })

    const base = config.appUrl.replace(/\/$/, '')
    const body = wrapUrlset(users.map((u) => urlEntry(`${base}/u/${u.username}`, u.updatedAt)))

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
}

export default sitemapRoutes
