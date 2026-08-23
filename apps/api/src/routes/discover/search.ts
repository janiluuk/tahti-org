// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { SearchQuerySchema, SearchResponseSchema, openApiResponse } from '@tahti/shared'
import { resolveCollectionCoverUrl } from '../../lib/collection-cover.js'

const searchRoute: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/search?q=...&type=all|tracks|artists&count=20 — public, no auth required.
  fastify.get(
    '/api/v1/search',
    {
      schema: {
        tags: ['discover'],
        description: 'Full-text search across public tracks and artists',
        response: openApiResponse(SearchResponseSchema, 'SearchResponse'),
      },
    },
    async (request, reply) => {
      const parsed = SearchQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid query' })
      }
      const { q, type, count } = parsed.data

      const [tracks, artists, collections] = await Promise.all([
        type === 'artists' || type === 'collections'
          ? []
          : fastify.prisma.archiveItem.findMany({
              where: {
                title: { contains: q, mode: 'insensitive' },
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
        type === 'tracks'
          ? []
          : fastify.prisma.user.findMany({
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
        type === 'tracks' || type === 'artists'
          ? []
          : fastify.prisma.collection.findMany({
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

      return reply.send({
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
      })
    },
  )
}

export default searchRoute
