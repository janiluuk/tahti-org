// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AutoRecordEnabledPatchSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

// M35: per-channel opt-out of auto-recording a finished broadcast to the archive.
const meRecordingSettings: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/channel/recording',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(AutoRecordEnabledPatchSchema, 'AutoRecordEnabled') },
    },
    async (request, reply) => {
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { autoRecordEnabled: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      return reply.send(channel)
    },
  )

  fastify.patch(
    '/api/me/channel/recording',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(AutoRecordEnabledPatchSchema, 'AutoRecordEnabled') },
    },
    async (request, reply) => {
      const parsed = AutoRecordEnabledPatchSchema.safeParse(request.body)
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
        data: { autoRecordEnabled: parsed.data.autoRecordEnabled },
        select: { autoRecordEnabled: true },
      })
      return reply.send(updated)
    },
  )
}

export default meRecordingSettings
