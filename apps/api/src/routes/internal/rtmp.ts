// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { verifyPassword } from '../../lib/password.js'
import { spawnChannelLiquidsoap } from '../../lib/orchestrator.js'
import { checkBroadcastCap, canAcceptSourceConnect } from '@tahti/shared/broadcast-cap'
import { broadcastSessionLogFields } from '@tahti/shared'
import { enqueueFinalizeBroadcastRecording } from '../../lib/queue.js'

// nginx-rtmp sends form-encoded bodies to on_publish / on_done / on_update
const rtmpRoutes: FastifyPluginAsync = async (fastify) => {
  // Called by nginx-rtmp when a stream connects. Return non-200 to deny.
  fastify.post(
    '/internal/rtmp/on_publish',
    { config: { rawBody: true } },
    async (request, reply) => {
      const body = request.body as Record<string, string>
      const streamName: string = body.name ?? ''

      const channel = await fastify.prisma.channel.findFirst({
        where: {
          // slug is the first segment before __
          slug: streamName.split('__')[0],
        },
        select: {
          id: true,
          slug: true,
          rtmpStreamKey: true,
          rtmpStreamKeyHash: true,
          state: true,
          userId: true,
          user: { select: { tier: true } },
        },
      })

      if (!channel) {
        fastify.log.warn({ streamName }, 'rtmp on_publish: channel not found')
        return reply.status(403).send('denied')
      }

      const valid = await verifyPassword(channel.rtmpStreamKeyHash, streamName)
      if (!valid) {
        fastify.log.warn({ slug: channel.slug }, 'rtmp on_publish: invalid stream key')
        return reply.status(403).send('denied')
      }

      const cap = await checkBroadcastCap(fastify.prisma, channel.userId, channel.user.tier)
      if (!canAcceptSourceConnect(cap, channel.state)) {
        fastify.log.info({ slug: channel.slug }, 'rtmp on_publish: weekly live cap reached')
        return reply.status(403).send('weekly_cap')
      }

      // Create broadcast record and mark channel LIVE
      const broadcast = await fastify.prisma.broadcast.create({
        data: { channelId: channel.id, source: 'RTMP' },
      })

      await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: { state: 'LIVE', goneLiveAt: new Date() },
      })

      // Tell orchestrator to ensure Liquidsoap is running for this channel
      spawnChannelLiquidsoap(channel.id, channel.slug, broadcast.id).catch((err: unknown) =>
        fastify.log.error({ err }, 'orchestrator spawn failed'),
      )

      fastify.log.info(
        broadcastSessionLogFields({
          broadcastId: broadcast.id,
          channelId: channel.id,
          slug: channel.slug,
          source: 'RTMP',
        }),
        'rtmp stream started',
      )
      return reply.status(200).send('allowed')
    },
  )

  // Called by nginx-rtmp when a stream disconnects.
  fastify.post('/internal/rtmp/on_done', async (request, reply) => {
    const body = request.body as Record<string, string>
    const streamName: string = body.name ?? ''

    const channel = await fastify.prisma.channel.findFirst({
      where: { slug: streamName.split('__')[0] },
      select: { id: true, slug: true },
    })

    if (!channel) return reply.status(200).send('ok')

    // Find the open broadcast
    const broadcast = await fastify.prisma.broadcast.findFirst({
      where: { channelId: channel.id, endedAt: null },
      orderBy: { startedAt: 'desc' },
    })

    if (broadcast) {
      await fastify.prisma.broadcast.update({
        where: { id: broadcast.id },
        data: { endedAt: new Date() },
      })
      enqueueFinalizeBroadcastRecording(broadcast.id).catch((err: unknown) =>
        fastify.log.error(
          {
            err,
            ...broadcastSessionLogFields({
              broadcastId: broadcast.id,
              channelId: channel.id,
              slug: channel.slug,
              source: 'RTMP',
            }),
          },
          'finalize-broadcast-recording enqueue failed',
        ),
      )
    }

    await fastify.prisma.channel.update({
      where: { id: channel.id },
      data: { state: 'OFFLINE', goneLiveAt: null },
    })

    fastify.log.info(
      broadcast
        ? broadcastSessionLogFields({
            broadcastId: broadcast.id,
            channelId: channel.id,
            slug: channel.slug,
            source: 'RTMP',
          })
        : { slug: channel.slug, channelId: channel.id },
      'rtmp stream ended',
    )
    return reply.status(200).send('ok')
  })

  // Heartbeat — keep channel state alive, track listener hours later.
  fastify.post('/internal/rtmp/on_update', async (_request, reply) => {
    return reply.status(200).send('ok')
  })
}

export default rtmpRoutes
