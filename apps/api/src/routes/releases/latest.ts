// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { LatestReleasesResponseSchema, openApiResponse } from '@tahti/shared'
import { resolveReleaseArtworkUrl } from '../../lib/release-artwork.js'

const VALID_TYPES = ['SINGLE', 'EP', 'ALBUM', 'COMPILATION', 'REMIX']

// GET /api/releases/latest?type=ALBUM,SINGLE&limit=10 — no listen-tracking
// exists for releases yet (they aren't played through a mechanism that
// reports playback progress), so this is chronological rather than
// ranked-by-listens, unlike /api/top-lists.
const latestReleasesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/releases/latest',
    { schema: { response: openApiResponse(LatestReleasesResponseSchema, 'LatestReleases') } },
    async (request, reply) => {
      const query = request.query as Record<string, unknown>
      let types: string[] | undefined
      if (typeof query.type === 'string' && query.type.length > 0) {
        types = query.type.split(',').filter((t) => VALID_TYPES.includes(t))
        if (types.length === 0) return reply.status(400).send({ error: 'Invalid type' })
      }
      const limit = Math.min(
        20,
        Math.max(1, Number.parseInt(String(query.limit ?? '10'), 10) || 10),
      )

      const releases = await fastify.prisma.release.findMany({
        where: { state: 'PUBLISHED', ...(types ? { type: { in: types as never[] } } : {}) },
        orderBy: { releaseDate: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          type: true,
          releaseDate: true,
          artworkUrl: true,
          artworkKey: true,
          smartLinkSlug: true,
          user: { select: { displayName: true } },
        },
      })

      const cards = await Promise.all(
        releases.map(async (r) => ({
          id: r.id,
          title: r.title,
          type: r.type,
          releaseDate: r.releaseDate.toISOString(),
          artworkUrl: await resolveReleaseArtworkUrl(r),
          smartLinkSlug: r.smartLinkSlug,
          artistDisplayName: r.user.displayName,
        })),
      )

      return reply.send({ releases: cards })
    },
  )
}

export default latestReleasesRoutes
