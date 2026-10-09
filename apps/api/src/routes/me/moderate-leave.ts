// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { SlugParamSchema, parseRouteParams } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const meModerateLeave: FastifyPluginAsync = async (fastify) => {
  // DELETE /api/me/moderate/:slug — stop moderating someone else's channel.
  // Only the owner could end the role before, so a moderator who no longer
  // wanted it had to ask to be removed.
  fastify.delete('/api/me/moderate/:slug', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const routeParams = parseRouteParams(SlugParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

    const channel = await fastify.prisma.channel.findUnique({
      where: { slug: routeParams.slug },
      select: { id: true, userId: true },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })
    if (channel.userId === user.id) {
      return reply.status(400).send({ error: 'You own this channel' })
    }

    const { count } = await fastify.prisma.channelModerator.deleteMany({
      where: { channelId: channel.id, userId: user.id },
    })
    // Same answer as for a channel that does not exist: whether an account
    // moderates a channel is not something to probe for.
    if (count === 0) return reply.status(404).send({ error: 'Channel not found' })

    return reply.status(204).send()
  })
}

export default meModerateLeave
