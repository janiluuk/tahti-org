// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { NotificationListSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const NOTIFICATION_LIMIT = 30

const meNotificationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/notifications — most recent notifications + unread count
  fastify.get(
    '/api/me/notifications',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: "M34: recipient's in-app notification inbox",
        response: openApiResponse(NotificationListSchema, 'NotificationList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const [notifications, unreadCount] = await Promise.all([
        fastify.prisma.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: NOTIFICATION_LIMIT,
          select: {
            id: true,
            type: true,
            title: true,
            body: true,
            url: true,
            readAt: true,
            createdAt: true,
            actor: { select: { username: true, displayName: true, avatarUrl: true } },
          },
        }),
        fastify.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
      ])

      return reply.send({
        notifications: notifications.map((n) => ({
          ...n,
          readAt: n.readAt?.toISOString() ?? null,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadCount,
      })
    },
  )

  // POST /api/me/notifications/read-all — mark every unread notification as read
  fastify.post(
    '/api/me/notifications/read-all',
    { preHandler: requireAuth, schema: { tags: ['channel'] } },
    async (request, reply) => {
      const user = request.sessionUser!
      await fastify.prisma.notification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() },
      })
      return reply.status(204).send()
    },
  )
}

export default meNotificationRoutes
