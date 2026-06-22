// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { enqueueWarmArchiveFallbackCache } from '../../lib/queue.js'
import { queueChannelLiveSocialPost } from '../../lib/social-post.js'

const meGoLiveRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/me/channel/go-live',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description:
          'Promote a private PREVIEW session to public LIVE — the artist has heard their own signal and confirms.',
        response: {
          200: { type: 'object', properties: { ok: { type: 'boolean' } } },
          409: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true, slug: true, state: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      if (channel.state !== 'PREVIEW') {
        return reply.status(409).send({ error: 'Channel is not in preview' })
      }

      const broadcast = await fastify.prisma.broadcast.findFirst({
        where: { channelId: channel.id, endedAt: null },
        orderBy: { startedAt: 'desc' },
      })
      if (!broadcast) return reply.status(409).send({ error: 'No active preview session' })

      await fastify.prisma.$transaction([
        fastify.prisma.channel.update({
          where: { id: channel.id },
          data: { state: 'LIVE', goneLiveAt: new Date() },
        }),
        fastify.prisma.broadcast.update({
          where: { id: broadcast.id },
          data: { wentLiveAt: new Date() },
        }),
      ])

      queueChannelLiveSocialPost(fastify.prisma, user.id, channel.id, channel.slug).catch(
        (err: unknown) =>
          fastify.log.warn({ err, slug: channel.slug }, 'channel live social post failed'),
      )

      enqueueWarmArchiveFallbackCache(channel.id).catch((err: unknown) =>
        fastify.log.error(
          { err, channelId: channel.id },
          'archive fallback cache warm enqueue failed',
        ),
      )

      fastify.log.info({ channelId: channel.id, slug: channel.slug }, 'channel promoted to live')
      return reply.send({ ok: true as const })
    },
  )
}

export default meGoLiveRoutes
