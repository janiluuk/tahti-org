// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  NotificationListSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const NOTIFICATION_LIMIT = 30

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  url: true,
  readAt: true,
  sticky: true,
  createdAt: true,
  actor: { select: { username: true, displayName: true, avatarUrl: true } },
} as const

const meNotificationRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/notifications — most recent notifications + unread count.
  // ?stickyOnly=true returns unread sticky notifications only (unbounded by
  // NOTIFICATION_LIMIT — see StickyNotificationBanner), for the dashboard's
  // must-dismiss banner, kept separate from the ordinary bell's list.
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
      const stickyOnly = (request.query as { stickyOnly?: string })?.stickyOnly === 'true'

      const [notifications, unreadCount] = await Promise.all([
        fastify.prisma.notification.findMany({
          where: stickyOnly ? { userId: user.id, sticky: true, readAt: null } : { userId: user.id },
          orderBy: { createdAt: 'desc' },
          ...(stickyOnly ? {} : { take: NOTIFICATION_LIMIT }),
          select: NOTIFICATION_SELECT,
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

  // PATCH /api/me/notifications/:id/read — dismiss exactly one notification.
  // Needed for sticky notifications: opening the bell marks everything read,
  // which would silently clear a sticky banner nobody actually dismissed.
  fastify.patch(
    '/api/me/notifications/:id/read',
    { preHandler: requireAuth },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const { count } = await fastify.prisma.notification.updateMany({
        where: { id: routeParams.id, userId: request.sessionUser!.id },
        data: { readAt: new Date() },
      })
      if (count === 0) return reply.status(404).send({ error: 'Notification not found' })
      return reply.status(204).send()
    },
  )
}

export default meNotificationRoutes
