// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireBoard } from '../../plugins/auth.js'
import { getRadioFeatureHistory, listRadioEligibleChannels } from '../../lib/radio-feature.js'

const RADIO_URL = process.env.RADIO_SERVICE_URL ?? 'http://tahti-radio:3004'

const adminRadioRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/admin/radio — aggregate radio status for the admin panel
  fastify.get(
    '/api/admin/radio',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (_request, reply) => {
      const [eligible, history, optedOut, nowPlaying] = await Promise.all([
        listRadioEligibleChannels(fastify.prisma),
        getRadioFeatureHistory(fastify.prisma, 20),
        fastify.prisma.channel.findMany({
          where: { metaStreamOptOut: true },
          select: {
            id: true,
            slug: true,
            state: true,
            user: { select: { displayName: true, username: true } },
          },
          orderBy: { user: { displayName: 'asc' } },
        }),
        fetch(`${RADIO_URL}/now-playing`, { signal: AbortSignal.timeout(2000) })
          .then((r) => r.json())
          .catch(() => ({ live: false, channel: null })),
      ])

      return reply.send({
        nowPlaying,
        eligible: eligible.map((ch) => ({
          channelId: ch.id,
          slug: ch.slug,
          artistName: ch.user.displayName,
          lastFeaturedAt: ch.lastFeaturedAt,
        })),
        history,
        optedOut: optedOut.map((ch) => ({
          channelId: ch.id,
          slug: ch.slug,
          artistName: ch.user.displayName,
          username: ch.user.username,
          isLive: ch.state === 'LIVE',
        })),
      })
    },
  )

  // POST /api/admin/radio/opt-out/:channelId — exclude channel from radio
  fastify.post(
    '/api/admin/radio/opt-out/:channelId',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { channelId } = request.params as { channelId: string }
      const channel = await fastify.prisma.channel.findUnique({ where: { id: channelId } })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      await fastify.prisma.channel.update({
        where: { id: channelId },
        data: { metaStreamOptOut: true },
      })
      return reply.send({ ok: true })
    },
  )

  // DELETE /api/admin/radio/opt-out/:channelId — re-enable channel for radio
  fastify.delete(
    '/api/admin/radio/opt-out/:channelId',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { channelId } = request.params as { channelId: string }
      const channel = await fastify.prisma.channel.findUnique({ where: { id: channelId } })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      await fastify.prisma.channel.update({
        where: { id: channelId },
        data: { metaStreamOptOut: false },
      })
      return reply.send({ ok: true })
    },
  )

  // POST /api/admin/radio/reset-rotation/:channelId — push channel to front of rotation
  fastify.post(
    '/api/admin/radio/reset-rotation/:channelId',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { channelId } = request.params as { channelId: string }
      const channel = await fastify.prisma.channel.findUnique({ where: { id: channelId } })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      await fastify.prisma.channel.update({
        where: { id: channelId },
        data: { lastFeaturedAt: null },
      })
      return reply.send({ ok: true })
    },
  )
}

export default adminRadioRoutes
