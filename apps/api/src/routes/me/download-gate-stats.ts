// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'

/** M22: aggregate follow/repost gate engagement for the artist dashboard. */
const downloadGateStatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/archive/:id/download-gate-stats',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { id } = request.params as { id: string }

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id, channel: { userId: user.id } },
        select: {
          id: true,
          repostToDownload: true,
          followToDownload: true,
        },
      })
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const [artistFollowerCount, repostAckCount, blockedDownloads] = await Promise.all([
        fastify.prisma.artistFollow.count({ where: { artistUserId: user.id } }),
        fastify.prisma.archiveRepostAck.count({ where: { archiveItemId: item.id } }),
        fastify.prisma.download.count({
          where: {
            archiveItemId: item.id,
            countedAt: null,
            reason: { in: ['gate_repost', 'gate_follow'] },
          },
        }),
      ])

      return reply.send({
        repostToDownload: item.repostToDownload,
        followToDownload: item.followToDownload,
        artistFollowerCount,
        repostAckCount,
        blockedDownloadAttempts: blockedDownloads,
      })
    },
  )
}

export default downloadGateStatsRoutes
