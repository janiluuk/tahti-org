// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import {
  checkBroadcastCap,
  FREE_WEEKLY_LIVE_CAP_SEC,
  isUnlimitedLiveTier,
} from '@tahti/shared/broadcast-cap'

const broadcastUsageRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/me/broadcast-usage', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const cap = await checkBroadcastCap(fastify.prisma, user.id, user.tier)

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { id: true, state: true },
    })

    const recentBroadcast = channel
      ? await fastify.prisma.broadcast.findFirst({
          where: {
            channelId: channel.id,
            endedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { endedAt: 'desc' },
          select: { endedAt: true },
        })
      : null

    return reply.send({
      tier: user.tier,
      unlimited: isUnlimitedLiveTier(user.tier),
      weeklyCapSeconds: FREE_WEEKLY_LIVE_CAP_SEC,
      secondsUsed: cap.secondsUsed,
      secondsRemaining: cap.allowed ? cap.secondsRemaining : 0,
      warnings: cap.allowed ? cap.warnings : [],
      inGrace: cap.allowed ? cap.inGrace : false,
      atCap: cap.allowed ? cap.inGrace : true,
      blocked: !cap.allowed,
      showUpgradeCta: user.tier === 'FREE' && !!recentBroadcast && channel?.state !== 'LIVE',
    })
  })
}

export default broadcastUsageRoutes
