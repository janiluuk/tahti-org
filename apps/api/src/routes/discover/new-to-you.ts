// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { NewToYouResponseSchema, openApiResponse } from '@tahti/shared'
import { buildNewToYou } from '../../lib/new-to-you.js'

const newToYouRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/discover/new-to-you',
    {
      schema: {
        tags: ['discover'],
        description:
          "Unheard public tracks matching the signed-in listener's follow and listen genres",
        response: openApiResponse(NewToYouResponseSchema, 'NewToYou'),
      },
    },
    async (request, reply) => {
      if (!request.sessionUser) {
        return reply.send({ authenticated: false, preferenceGenres: [], items: [] })
      }

      const { preferenceGenres, items } = await buildNewToYou(
        fastify.prisma,
        request.sessionUser.id,
      )
      return reply.send({ authenticated: true, preferenceGenres, items })
    },
  )
}

export default newToYouRoute
