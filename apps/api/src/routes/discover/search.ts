// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { SearchQuerySchema, SearchResponseSchema, openApiResponse } from '@tahti/shared'

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

      const [tracks, artists] = await Promise.all([
        type === 'artists'
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
      ])

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
      })
    },
  )
}

export default searchRoute
