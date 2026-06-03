// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

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

    const storageInfo = await fastify.prisma.user.findUnique({
      where: { id: user.id },
      select: { storageUsedBytes: true, softTargetBytes: true },
    })

    return reply.send({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      tier: user.tier,
      emailVerifiedAt: user.emailVerifiedAt,
      isMember: user.isMember,
      isBoard: user.isBoard,
      membership,
      channel,
      storage: {
        usedBytes: storageInfo?.storageUsedBytes?.toString() ?? '0',
        softTargetBytes: storageInfo?.softTargetBytes?.toString() ?? '524288000',
      },
    })
  })
}

export default meRoute
