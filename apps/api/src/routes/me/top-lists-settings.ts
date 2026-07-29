// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  TopListsOptOutPatchSchema,
  TopListsOptOutResponseSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const meTopListsSettings: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/top-lists-opt-out — default applied to new tracks
  fastify.get(
    '/api/me/top-lists-opt-out',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(TopListsOptOutResponseSchema, 'TopListsOptOut') },
    },
    async (request, reply) => {
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.sessionUser!.id },
        select: { topListsOptOut: true },
      })
      return reply.send(user)
    },
  )

  // PATCH /api/me/top-lists-opt-out
  fastify.patch(
    '/api/me/top-lists-opt-out',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(TopListsOptOutResponseSchema, 'TopListsOptOut') },
    },
    async (request, reply) => {
      const parsed = TopListsOptOutPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }

      const updated = await fastify.prisma.user.update({
        where: { id: request.sessionUser!.id },
        data: { topListsOptOut: parsed.data.topListsOptOut },
        select: { topListsOptOut: true },
      })
      return reply.send(updated)
    },
  )
}

export default meTopListsSettings
