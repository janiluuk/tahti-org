// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { buildGateDailySeries } from '../../lib/download-gate-daily.js'

/** M22: aggregate follow/repost gate engagement for the artist dashboard. */
const downloadGateStatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/download-gate-stats',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) {
        return reply.send({
          artistFollowerCount: 0,
          items: [],
          totals: { repostAcks: 0, blockedAttempts: 0 },
          daily: [],
        })
      }

      const gatedItems = await fastify.prisma.archiveItem.findMany({
        where: {
          channelId: channel.id,
          OR: [{ repostToDownload: true }, { followToDownload: true }],
        },
        select: { id: true, title: true, repostToDownload: true, followToDownload: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      const itemIds = gatedItems.map((i) => i.id)
      const [repostByItem, blockedByItem, followerCount] = await Promise.all([
        itemIds.length > 0
          ? fastify.prisma.archiveRepostAck.groupBy({
              by: ['archiveItemId'],
              where: { archiveItemId: { in: itemIds } },
              _count: { _all: true },
            })
          : [],
        itemIds.length > 0
          ? fastify.prisma.download.groupBy({
              by: ['archiveItemId'],
              where: {
                archiveItemId: { in: itemIds },
                countedAt: null,
                reason: { in: ['gate_repost', 'gate_follow'] },
              },
              _count: { _all: true },
            })
          : [],
        fastify.prisma.artistFollow.count({ where: { artistUserId: user.id } }),
      ])

      const repostMap = new Map(repostByItem.map((r) => [r.archiveItemId, r._count._all]))
      const blockedMap = new Map(blockedByItem.map((b) => [b.archiveItemId, b._count._all]))

      const items = gatedItems.map((item) => ({
        archiveItemId: item.id,
        title: item.title,
        repostToDownload: item.repostToDownload,
        followToDownload: item.followToDownload,
        repostAckCount: repostMap.get(item.id) ?? 0,
        blockedDownloadAttempts: blockedMap.get(item.id) ?? 0,
      }))

      const daily = await buildGateDailySeries(fastify.prisma, channel.id)

      return reply.send({
        artistFollowerCount: followerCount,
        items,
        totals: {
          repostAcks: items.reduce((s, i) => s + i.repostAckCount, 0),
          blockedAttempts: items.reduce((s, i) => s + i.blockedDownloadAttempts, 0),
        },
        daily,
      })
    },
  )

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
