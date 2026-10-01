// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  NotificationListQuerySchema,
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
  // ?limit=1..50 (default NOTIFICATION_LIMIT); ?before=<id> pages to the ones
  // older than that notification. ?stickyOnly=true returns unread sticky
  // notifications only (unbounded) for the must-acknowledge toaster.
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
      const query = NotificationListQuerySchema.safeParse(request.query ?? {})
      if (!query.success) return reply.status(400).send({ error: 'Invalid query' })
      const stickyOnly = query.data.stickyOnly === 'true'
      const limit = query.data.limit ?? NOTIFICATION_LIMIT

      if (!stickyOnly && query.data.before) {
        const anchor = await fastify.prisma.notification.findFirst({
          where: { id: query.data.before, userId: user.id },
          select: { id: true },
        })
        if (!anchor) return reply.status(400).send({ error: 'Unknown notification cursor' })
      }

      const [rows, unreadCount] = await Promise.all([
        fastify.prisma.notification.findMany({
          where: stickyOnly ? { userId: user.id, sticky: true, readAt: null } : { userId: user.id },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...(stickyOnly
            ? {}
            : {
                take: limit + 1,
                ...(query.data.before ? { cursor: { id: query.data.before }, skip: 1 } : {}),
              }),
          select: NOTIFICATION_SELECT,
        }),
        fastify.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
      ])
      const hasMore = !stickyOnly && rows.length > limit
      const notifications = hasMore ? rows.slice(0, limit) : rows

      return reply.send({
        notifications: notifications.map((n) => ({
          ...n,
          readAt: n.readAt?.toISOString() ?? null,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadCount,
        hasMore,
      })
    },
  )

  // POST /api/me/notifications/read-all — mark every unread *non-sticky*
  // notification as read. Sticky rows stay unread until PATCH :id/read
  // (Acknowledge on the toaster / inbox).
  fastify.post(
    '/api/me/notifications/read-all',
    { preHandler: requireAuth, schema: { tags: ['channel'] } },
    async (request, reply) => {
      const user = request.sessionUser!
      await fastify.prisma.notification.updateMany({
        where: { userId: user.id, readAt: null, sticky: false },
        data: { readAt: new Date() },
      })
      return reply.status(204).send()
    },
  )

  // PATCH /api/me/notifications/:id/read — acknowledge exactly one notification.
  // Sticky notices are not cleared by read-all / opening the bell.
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
