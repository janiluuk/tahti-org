// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { PrismaClient } from '@tahti/db'
import {
  SearchQuerySchema,
  SearchResponseSchema,
  type SearchResponse,
  openApiResponse,
} from '@tahti/shared'
import { resolveCollectionCoverUrl } from '../../lib/collection-cover.js'

/** Tags are stored as written (trimmed, case kept), and Prisma's array `has`
 * is case-sensitive, so the case-insensitive match needs raw SQL. */
async function publicSoundIdsWithTag(prisma: PrismaClient, tag: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "channel"."Sound"
    WHERE "isPublic" = true
      AND "status" = 'READY'
      AND EXISTS (SELECT 1 FROM unnest("tags") AS t WHERE lower(t) = lower(${tag}))
  `
  return rows.map((r) => r.id)
}

/** Core search, shared by the public REST route and the MCP `search` tool —
 * kept as one function so the two surfaces can't drift out of sync. */
export async function performSearch(
  prisma: PrismaClient,
  {
    q,
    tag,
    type,
    count,
  }: {
    q?: string
    tag?: string
    type: 'all' | 'tracks' | 'artists' | 'collections'
    count: number
  },
): Promise<SearchResponse> {
  const searchTracks = (q || tag) && type !== 'artists' && type !== 'collections'
  const tagIds = searchTracks && tag ? await publicSoundIdsWithTag(prisma, tag) : null
  const [tracks, artists, collections] = await Promise.all([
    !searchTracks
      ? []
      : prisma.sound.findMany({
          where: {
            ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
            ...(tagIds ? { id: { in: tagIds } } : {}),
            isPublic: true,
            status: 'READY',
            channel: { user: { deletedAt: null, suspendedAt: null } },
          },
          take: count,
          orderBy: { releasedAt: 'desc' },
          select: {
            id: true,
            title: true,
            artistName: true,
            durationSec: true,
            bannerUrl: true,
            channel: { select: { slug: true, user: { select: { displayName: true } } } },
          },
        }),
    !q || type === 'tracks'
      ? []
      : prisma.user.findMany({
          where: {
            OR: [
              { displayName: { contains: q, mode: 'insensitive' } },
              { username: { contains: q, mode: 'insensitive' } },
            ],
            deletedAt: null,
            suspendedAt: null,
          },
          take: count,
          orderBy: { displayName: 'asc' },
          select: {
            username: true,
            displayName: true,
            avatarUrl: true,
            channel: { select: { slug: true } },
          },
        }),
    !q || type === 'tracks' || type === 'artists'
      ? []
      : prisma.collection.findMany({
          where: {
            name: { contains: q, mode: 'insensitive' },
            isPublic: true,
            user: { deletedAt: null, suspendedAt: null },
          },
          take: count,
          orderBy: { name: 'asc' },
          select: {
            slug: true,
            name: true,
            coverUrl: true,
            coverKey: true,
            user: { select: { username: true, displayName: true } },
          },
        }),
  ])

  const collectionsWithCovers = await Promise.all(
    collections.map(async (c) => ({
      slug: c.slug,
      name: c.name,
      coverUrl: await resolveCollectionCoverUrl(c),
      ownerUsername: c.user.username,
      ownerDisplayName: c.user.displayName,
    })),
  )

  return {
    tracks: tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artistName: t.artistName ?? t.channel.user.displayName,
      channelSlug: t.channel.slug,
      durationSec: t.durationSec,
      coverUrl: t.bannerUrl,
    })),
    artists: artists.map((a) => ({
      username: a.username,
      displayName: a.displayName,
      avatarUrl: a.avatarUrl,
      channelSlug: a.channel?.slug ?? null,
    })),
    collections: collectionsWithCovers,
  }
}

const searchRoute: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/search?q=...&tag=...&type=all|tracks|artists&count=20 — public, no auth required.
  fastify.get(
    '/api/v1/search',
    {
      schema: {
        tags: ['discover'],
        description:
          'Full-text search across public tracks and artists; `tag` filters tracks by exact tag',
        response: openApiResponse(SearchResponseSchema, 'SearchResponse'),
      },
    },
    async (request, reply) => {
      const parsed = SearchQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid query' })
      }
      if (!parsed.data.q && !parsed.data.tag) {
        return reply.status(400).send({ error: 'q or tag is required' })
      }
      const result = await performSearch(fastify.prisma, parsed.data)
      return reply.send(result)
    },
  )
}

export default searchRoute
