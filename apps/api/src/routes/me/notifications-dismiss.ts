// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  NotificationClearQuerySchema,
  NotificationClearResponseSchema,
  openApiNoContentResponse,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

// The inbox only ever grew: notifications could be read but never removed.
const meNotificationDismissRoutes: FastifyPluginAsync = async (fastify) => {
  // DELETE /api/me/notifications/:id — remove one notification. A sticky
  // notice has to be acknowledged first, so it can't be dismissed unseen.
  fastify.delete(
    '/api/me/notifications/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Remove one of your notifications',
        response: openApiNoContentResponse(),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const row = await fastify.prisma.notification.findFirst({
        where: { id: routeParams.id, userId: request.sessionUser!.id },
        select: { id: true, sticky: true, readAt: true },
      })
      if (!row) return reply.status(404).send({ error: 'Notification not found' })
      if (row.sticky && !row.readAt) {
        return reply.status(409).send({ error: 'Acknowledge this notice before removing it' })
      }
      await fastify.prisma.notification.delete({ where: { id: row.id } })
      return reply.status(204).send()
    },
  )

  // DELETE /api/me/notifications?read=true — clear every notification you
  // have already read. Unread ones stay.
  fastify.delete(
    '/api/me/notifications',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Remove all of your read notifications',
        response: openApiResponse(NotificationClearResponseSchema, 'NotificationClear'),
      },
    },
    async (request, reply) => {
      const query = NotificationClearQuerySchema.safeParse(request.query ?? {})
      if (!query.success) return reply.status(400).send({ error: 'Pass read=true' })
      const { count } = await fastify.prisma.notification.deleteMany({
        where: { userId: request.sessionUser!.id, readAt: { not: null } },
      })
      return reply.send({ removed: count })
    },
  )
}

export default meNotificationDismissRoutes
