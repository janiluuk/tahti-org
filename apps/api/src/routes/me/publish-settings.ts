// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AutoPublishBroadcastPatchSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

// Persistent per-channel default for a new broadcast's autoArchive value — see
// recording-settings.ts for the paired "store past broadcasts" toggle.
const mePublishSettings: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/channel/publish-defaults',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(AutoPublishBroadcastPatchSchema, 'AutoPublishBroadcast'),
      },
    },
    async (request, reply) => {
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { autoPublishBroadcast: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      return reply.send(channel)
    },
  )

  fastify.patch(
    '/api/me/channel/publish-defaults',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        body: {
          type: 'object',
          properties: { autoPublishBroadcast: { type: 'boolean' } },
          required: ['autoPublishBroadcast'],
        },
        response: openApiResponse(AutoPublishBroadcastPatchSchema, 'AutoPublishBroadcast'),
      },
    },
    async (request, reply) => {
      const parsed = AutoPublishBroadcastPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const updated = await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: { autoPublishBroadcast: parsed.data.autoPublishBroadcast },
        select: { autoPublishBroadcast: true },
      })
      return reply.send(updated)
    },
  )
}

export default mePublishSettings
