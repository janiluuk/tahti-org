// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { IdParamSchema, parseRouteParams } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const releaseAnalyticsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/releases/:id/analytics',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: 'Phase 9: smart link views and DSP click counts',
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const user = request.sessionUser!

      const release = await fastify.prisma.release.findFirst({
        where: { id: routeParams.id, userId: user.id },
        select: {
          id: true,
          smartLinkSlug: true,
          smartLinkViewCount: true,
        },
      })

      if (!release) return reply.status(404).send({ error: 'Release not found' })

      const clicks = await fastify.prisma.smartLinkClick.findMany({
        where: { releaseId: release.id },
        select: { platform: true },
      })

      const clicksByPlatform: Record<string, number> = {}
      for (const click of clicks) {
        clicksByPlatform[click.platform] = (clicksByPlatform[click.platform] ?? 0) + 1
      }
      const totalClicks = clicks.length

      return reply.send({
        releaseId: release.id,
        smartLinkSlug: release.smartLinkSlug,
        smartLinkViewCount: release.smartLinkViewCount,
        totalClicks,
        clicksByPlatform,
      })
    },
  )
}

export default releaseAnalyticsRoutes
