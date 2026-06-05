// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { verifyPassword } from '../../lib/password.js'
import { spawnChannelLiquidsoap } from '../../lib/orchestrator.js'
import { checkBroadcastCap, canAcceptSourceConnect } from '@tahti/shared/broadcast-cap'
import {
  broadcastSessionLogFields,
  IngestForbiddenTextSchema,
  IngestInvalidTextSchema,
  IngestOkTextSchema,
  RtmpPublishAllowTextSchema,
  RtmpWebhookBodySchema,
  openApiResponse,
  openApiResponses,
} from '@tahti/shared'
import { enqueueFinalizeBroadcastRecording } from '../../lib/queue.js'

// nginx-rtmp sends form-encoded bodies to on_publish / on_done / on_update
const rtmpRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/internal/rtmp/on_publish',
    {
      config: { rawBody: true },
      schema: {
        tags: ['internal'],
        response: openApiResponses([
          { status: 200, schema: RtmpPublishAllowTextSchema, name: 'RtmpPublishAllowText' },
          { status: 400, schema: IngestInvalidTextSchema, name: 'IngestInvalidText' },
          { status: 403, schema: IngestForbiddenTextSchema, name: 'IngestForbiddenText' },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = RtmpWebhookBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send('invalid')
      }
      const streamName = parsed.data.name

      const channel = await fastify.prisma.channel.findFirst({
        where: {
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

      const broadcast = await fastify.prisma.broadcast.create({
        data: { channelId: channel.id, source: 'RTMP' },
      })

      await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: { state: 'LIVE', goneLiveAt: new Date() },
      })

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

  fastify.post(
    '/internal/rtmp/on_done',
    {
      schema: { tags: ['internal'], response: openApiResponse(IngestOkTextSchema, 'IngestOkText') },
    },
    async (request, reply) => {
      const parsed = RtmpWebhookBodySchema.safeParse(request.body)
      if (!parsed.success) return reply.status(200).send('ok')
      const streamName = parsed.data.name

      const channel = await fastify.prisma.channel.findFirst({
        where: { slug: streamName.split('__')[0] },
        select: { id: true, slug: true },
      })

      if (!channel) return reply.status(200).send('ok')

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
    },
  )

  fastify.post(
    '/internal/rtmp/on_update',
    {
      schema: { tags: ['internal'], response: openApiResponse(IngestOkTextSchema, 'IngestOkText') },
    },
    async (_request, reply) => {
      return reply.status(200).send('ok')
    },
  )
}

export default rtmpRoutes
