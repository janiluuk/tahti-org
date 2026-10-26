// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  StatsAudienceQuerySchema,
  StatsAudienceResponseSchema,
  StatsAudienceWindowQuerySchema,
  StatsLocationsResponseSchema,
  StatsLoyaltyResponseSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import {
  AUDIENCE_MIN_BUCKET,
  buildAudienceShares,
  buildLocationShares,
  buildLoyaltyCurve,
} from '../../lib/listen-audience.js'

/** Studio audience breakdown from listen sessions: shares only, never rows
 * about a single listener. */
const meStatsAudienceRoutes: FastifyPluginAsync = async (fastify) => {
  const ownChannelId = async (userId: string) =>
    (
      await fastify.prisma.channel.findUnique({
        where: { userId },
        select: { id: true },
      })
    )?.id ?? null

  fastify.get(
    '/api/me/stats/audience',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description:
          'Share of listens by browser, OS, device type, device vendor, source (referrer host) or surface (where on Tahti it played: CHANNEL_PAGE, TAHTI_RADIO, ARTIST_PROFILE, DISCOVER, LIBRARY, EMBED, OTHER); names with fewer than 5 listens fold into Other',
        response: openApiResponse(StatsAudienceResponseSchema, 'StatsAudience'),
      },
    },
    async (request, reply) => {
      const parsed = StatsAudienceQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }
      const { dimension, ...window } = parsed.data
      const channelId = await ownChannelId(request.sessionUser!.id)
      const shares = channelId
        ? await buildAudienceShares(fastify.prisma, channelId, dimension, window)
        : { total: 0, items: [] }
      return reply.send({ dimension, minBucket: AUDIENCE_MIN_BUCKET, ...shares })
    },
  )

  fastify.get(
    '/api/me/stats/locations',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description:
          'Share of listens by country and by city; countries under 5 listens fold into Other and such cities are left out',
        response: openApiResponse(StatsLocationsResponseSchema, 'StatsLocations'),
      },
    },
    async (request, reply) => {
      const parsed = StatsAudienceWindowQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }
      const channelId = await ownChannelId(request.sessionUser!.id)
      const locations = channelId
        ? await buildLocationShares(fastify.prisma, channelId, parsed.data)
        : { total: 0, countries: [], cities: [] }
      return reply.send({ minBucket: AUDIENCE_MIN_BUCKET, ...locations })
    },
  )

  fastify.get(
    '/api/me/stats/loyalty',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description:
          'Listener loyalty: share of on-demand listens that reached 0, 10 … 100 % of the track; empty under 5 listens',
        response: openApiResponse(StatsLoyaltyResponseSchema, 'StatsLoyalty'),
      },
    },
    async (request, reply) => {
      const parsed = StatsAudienceWindowQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }
      const channelId = await ownChannelId(request.sessionUser!.id)
      const curve = channelId
        ? await buildLoyaltyCurve(fastify.prisma, channelId, parsed.data)
        : { total: 0, points: [] }
      return reply.send({ minBucket: AUDIENCE_MIN_BUCKET, ...curve })
    },
  )
}

export default meStatsAudienceRoutes
