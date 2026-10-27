// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  NotificationUnreadCountsSchema,
  notificationKindOf,
  openApiResponse,
  type NotificationKind,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const meNotificationCountRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/notifications/unread-counts — unread notifications per kind
  // (the groups `?kind=` filters by), so the inbox can show where the new
  // ones are before you open each filter.
  fastify.get(
    '/api/me/notifications/unread-counts',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Your unread notifications, in total and per kind',
        response: openApiResponse(NotificationUnreadCountsSchema, 'NotificationUnreadCounts'),
      },
    },
    async (request, reply) => {
      const rows = await fastify.prisma.notification.groupBy({
        by: ['type'],
        where: { userId: request.sessionUser!.id, readAt: null },
        _count: { _all: true },
      })
      const byKind: Record<NotificationKind, number> = {
        social: 0,
        music: 0,
        money: 0,
        governance: 0,
        other: 0,
      }
      let total = 0
      for (const row of rows) {
        byKind[notificationKindOf(row.type)] += row._count._all
        total += row._count._all
      }
      return reply.send({ total, byKind })
    },
  )
}

export default meNotificationCountRoutes
