// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Backs the "Send test notification" tab on /admin/news. Group targeting is
// deliberately not built yet (no group concept exists in this codebase) —
// single-user only for now.

import type { FastifyPluginAsync } from 'fastify'
import {
  SendTestNotificationResponseSchema,
  SendTestNotificationSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { notifyUserAdminTest } from '@tahti/db'

const adminNotificationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/admin/notifications/test',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(SendTestNotificationResponseSchema, 'AdminTestNotificationSent'),
      },
    },
    async (request, reply) => {
      const parsed = SendTestNotificationSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }

      const target = await fastify.prisma.user.findUnique({
        where: { username: parsed.data.targetUsername },
        select: { id: true },
      })
      if (!target) return reply.status(404).send({ error: 'User not found' })

      await notifyUserAdminTest(fastify.prisma, target.id, {
        title: parsed.data.title,
        body: parsed.data.body,
        url: parsed.data.url,
      })
      return reply.send({ ok: true })
    },
  )
}

export default adminNotificationsRoutes
