// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { RadioFeaturedPatchSchema } from '@tahti/shared'
import { config } from '../../config.js'
import { listRadioEligibleChannels, recordRadioFeature } from '../../lib/radio-feature.js'

const HLS_BASE = config.hlsBaseUrl

function requireInternalAuth(authHeader: string | undefined): boolean {
  return authHeader === `Bearer ${config.internalSecret}`
}

// M16 — internal Tahti Radio orchestration (tahti-radio service / worker-light)
const internalRadioRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/internal/radio/current-live',
    {
      schema: {
        tags: ['internal'],
        description: 'M16: eligible live channels for Tahti Radio picker',
      },
    },
    async (request, reply) => {
      if (!requireInternalAuth(request.headers.authorization)) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      const channels = await listRadioEligibleChannels(fastify.prisma)
      return reply.send(
        channels.map((ch) => ({
          channelId: ch.id,
          slug: ch.slug,
          artistName: ch.user.displayName,
          hlsUrl: `${HLS_BASE}/${ch.slug}/index.m3u8`,
          lastFeaturedAt: ch.lastFeaturedAt,
        })),
      )
    },
  )

  fastify.patch(
    '/api/v1/internal/radio/featured',
    {
      schema: {
        tags: ['internal'],
        description: 'M16: mark channel as featured on Tahti Radio',
      },
    },
    async (request, reply) => {
      if (!requireInternalAuth(request.headers.authorization)) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      const parsed = RadioFeaturedPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid body',
        })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { id: parsed.data.channelId },
        select: { id: true, state: true, metaStreamOptOut: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      if (channel.state !== 'LIVE' || channel.metaStreamOptOut) {
        return reply.status(400).send({ error: 'Channel not eligible for Tahti Radio' })
      }

      await recordRadioFeature(fastify.prisma, channel.id)
      return reply.send({ ok: true, channelId: channel.id })
    },
  )
}

export default internalRadioRoutes
