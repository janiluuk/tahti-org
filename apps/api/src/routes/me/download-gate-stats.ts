// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  DownloadGateItemDetailResponseSchema,
  DownloadGateStatsResponseSchema,
  IdParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { buildDownloadGateStats } from '../../lib/download-gate-summary.js'
import { GATE_DAILY_SERIES_DAYS } from '../../lib/download-gate-daily.js'

/** M22: aggregate follow/repost gate engagement for the artist dashboard. */
const downloadGateStatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/download-gate-stats',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M22: follow/repost download gate funnel (14-day UTC series)',
        response: openApiResponse(DownloadGateStatsResponseSchema, 'DownloadGateStats'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      return reply.send(await buildDownloadGateStats(fastify.prisma, user.id))
    },
  )

  fastify.get(
    '/api/me/archive/:id/download-gate-stats',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M22: per-archive-item download gate funnel (14-day counted downloads)',
        response: openApiResponse(DownloadGateItemDetailResponseSchema, 'DownloadGateItemDetail'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id, channel: { userId: user.id } },
        select: {
          id: true,
          repostToDownload: true,
          followToDownload: true,
        },
      })
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const since = new Date(
        Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate() - (GATE_DAILY_SERIES_DAYS - 1),
        ),
      )

      const [artistFollowerCount, repostAckCount, blockedDownloads, countedDownloads] =
        await Promise.all([
          fastify.prisma.artistFollow.count({ where: { artistUserId: user.id } }),
          fastify.prisma.archiveRepostAck.count({ where: { archiveItemId: item.id } }),
          fastify.prisma.download.count({
            where: {
              archiveItemId: item.id,
              countedAt: null,
              reason: { in: ['gate_repost', 'gate_follow'] },
            },
          }),
          fastify.prisma.download.count({
            where: {
              archiveItemId: item.id,
              countedAt: { not: null },
              createdAt: { gte: since },
            },
          }),
        ])

      return reply.send({
        repostToDownload: item.repostToDownload,
        followToDownload: item.followToDownload,
        artistFollowerCount,
        repostAckCount,
        blockedDownloadAttempts: blockedDownloads,
        countedDownloadCount: countedDownloads,
      })
    },
  )
}

export default downloadGateStatsRoutes
