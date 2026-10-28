// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { LatestTracksResponseSchema, openApiResponse } from '@tahti/shared'
import { toGatedGalleryItem } from '../../lib/playback-url.js'
import { listedArtistSoundWhere } from '../../lib/listed-artist.js'

const DEFAULT_LIMIT = 24
const MAX_LIMIT = 50
const VALID_CONTENT_TYPES = [
  'LIVE',
  'TRACK',
  'DJ_SET',
  'PODCAST',
  'REMIX',
  'SHOW',
  'EPISODE',
  'CLIP',
  'EMBED',
]

// GET /api/discover/latest-tracks?limit=24&genre=Techno&contentTypes=DJ_SET
// — public, no auth required. Newest public sound items, for the Discover
// "Latest tracks" widget — chronological, not ranked by listens (that's
// /api/top-lists).
const latestTracksRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/discover/latest-tracks',
    {
      schema: {
        tags: ['discover'],
        description: 'Newest public tracks, for the Discover "Latest tracks" widget',
        response: openApiResponse(LatestTracksResponseSchema, 'LatestTracks'),
      },
    },
    async (request, reply) => {
      const query = request.query as Record<string, unknown>
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, Number.parseInt(String(query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
      )
      const genre =
        typeof query.genre === 'string' && query.genre.length > 0 ? query.genre : undefined

      let contentTypes: string[] | undefined
      if (typeof query.contentTypes === 'string' && query.contentTypes.length > 0) {
        contentTypes = query.contentTypes.split(',').filter((t) => VALID_CONTENT_TYPES.includes(t))
        if (contentTypes.length === 0) {
          return reply.status(400).send({ error: 'Invalid contentTypes' })
        }
      }

      const rows = await fastify.prisma.sound.findMany({
        where: {
          isPublic: true,
          status: 'READY',
          ...listedArtistSoundWhere,
          ...(genre ? { genre } : {}),
          ...(contentTypes ? { contentType: { in: contentTypes as never[] } } : {}),
          OR: [{ mp3Key: { not: null } }, { flacKey: { not: null } }],
        },
        orderBy: { releasedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          artistName: true,
          bannerUrl: true,
          durationSec: true,
          mp3Key: true,
          flacKey: true,
          accessMode: true,
          purchaseTierId: true,
          genre: true,
          genreCustom: true,
          peaks: true,
          createdAt: true,
          downloadsEnabled: true,
          _count: { select: { likes: true, listenEvents: true, comments: true } },
          channel: {
            select: {
              slug: true,
              userId: true,
              user: { select: { username: true, displayName: true } },
            },
          },
        },
      })

      const viewerUserId = request.sessionUser?.id ?? null
      const downloadCounts = rows.length
        ? await fastify.prisma.download.groupBy({
            by: ['soundId'],
            where: { soundId: { in: rows.map((row) => row.id) }, countedAt: { not: null } },
            _count: { _all: true },
          })
        : []
      const downloadsBySoundId = new Map(
        downloadCounts.map((row) => [row.soundId, row._count._all] as const),
      )
      const items = await Promise.all(
        rows.map(async (item) => ({
          ...(await toGatedGalleryItem(fastify.prisma, item, viewerUserId)),
          genre: item.genreCustom ?? item.genre,
          peaks: Array.isArray(item.peaks) ? (item.peaks as number[]) : null,
          createdAt: item.createdAt.toISOString(),
          downloadsEnabled: item.downloadsEnabled,
          likeCount: item._count.likes,
          commentCount: item._count.comments,
          playCount: item._count.listenEvents,
          downloadCount: downloadsBySoundId.get(item.id) ?? 0,
        })),
      )

      return reply.send({ items })
    },
  )
}

export default latestTracksRoute
