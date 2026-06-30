// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  NotificationPreferencesSchema,
  PatchNotificationPreferencesSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const SELECT = {
  notifyMoneyMovesEmail: true,
  notifyMoneyMovesInApp: true,
  notifyListenerActivityEmail: true,
  notifyWeeklyRecapEmail: true,
} as const

// /dashboard/settings/notifications instrument-pattern view (docs/design/ground-rules.md)
const meNotificationPreferencesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/notification-preferences',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['settings'],
        response: openApiResponse(NotificationPreferencesSchema, 'NotificationPreferences'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const row = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: SELECT,
      })
      if (!row) return reply.status(404).send({ error: 'User not found' })
      return reply.send(row)
    },
  )

  fastify.patch(
    '/api/me/notification-preferences',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['settings'],
        response: openApiResponse(NotificationPreferencesSchema, 'NotificationPreferences'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = PatchNotificationPreferencesSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      if (Object.keys(parsed.data).length === 0) {
        return reply.status(400).send({ error: 'Nothing to update' })
      }

      const updated = await fastify.prisma.user.update({
        where: { id: user.id },
        data: parsed.data,
        select: SELECT,
      })
      return reply.send(updated)
    },
  )
}

export default meNotificationPreferencesRoutes
