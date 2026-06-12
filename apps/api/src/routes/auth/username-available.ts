// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  UsernameAvailabilityQuerySchema,
  UsernameAvailabilityResponseSchema,
  openApiResponse,
} from '@tahti/shared'

/** Suggest two alternative handles when the requested one is taken. */
function suggestHandles(username: string): string[] {
  const suffixes = ['live', 'music']
  return suffixes.map((suffix) => `${username}-${suffix}`)
}

const usernameAvailableRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/auth/username-available',
    {
      schema: {
        tags: ['auth'],
        response: openApiResponse(UsernameAvailabilityResponseSchema, 'UsernameAvailability'),
      },
    },
    async (request, reply) => {
      const parsed = UsernameAvailabilityQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid username' })
      }
      const { username } = parsed.data

      const existing = await fastify.prisma.user.findUnique({
        where: { username },
        select: { id: true },
      })

      if (!existing) {
        return reply.send({ available: true })
      }

      const candidates = suggestHandles(username)
      const taken = await fastify.prisma.user.findMany({
        where: { username: { in: candidates } },
        select: { username: true },
      })
      const takenSet = new Set(taken.map((u) => u.username))
      const suggestions = candidates.filter((c) => !takenSet.has(c))

      return reply.send({ available: false, suggestions })
    },
  )
}

export default usernameAvailableRoute
