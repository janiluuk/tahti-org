// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'

const meRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!

    const membership = await fastify.prisma.membership.findUnique({
      where: { userId: user.id },
      select: { status: true, activatedAt: true },
    })

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { slug: true, state: true },
    })

    return reply.send({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      tier: user.tier,
      emailVerifiedAt: user.emailVerifiedAt,
      membership,
      channel,
    })
  })
}

export default meRoute
