// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { parseRouteParams, SlugParamSchema } from '@tahti/shared'
import { z } from 'zod'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

const ChannelKindPatchSchema = z.object({
  channelKind: z.enum(['ARTIST', 'RADIO']),
})

const adminChannelKindRoutes: FastifyPluginAsync = async (fastify) => {
  // PATCH /api/admin/channels/:slug/kind — mark a channel as an artist channel
  // or a radio station (radio channels render the station layout on /channel/:slug)
  fastify.patch(
    '/api/admin/channels/:slug/kind',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: "Set a channel's kind (ARTIST or RADIO)",
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = ChannelKindPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const { slug } = routeParams
      const { channelKind } = parsed.data

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true, userId: true, channelKind: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      if (channel.channelKind !== channelKind) {
        await fastify.prisma.channel.update({
          where: { id: channel.id },
          data: { channelKind },
        })
        await auditLog(fastify.prisma, {
          action: 'CHANNEL_KIND_CHANGE',
          actorId: request.sessionUser!.id,
          targetId: channel.userId,
          meta: { channelId: channel.id, slug, from: channel.channelKind, to: channelKind },
        })
      }

      return reply.send({ slug, channelKind })
    },
  )
}

export default adminChannelKindRoutes
