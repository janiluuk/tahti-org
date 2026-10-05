// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { IdParamSchema, openApiResponse, parseRouteParams } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { submitHearthisSoundExport } from '../../lib/hearthis-export-submit.js'

const HearthisExportQueuedSchema = z.object({
  soundId: z.string().min(1),
  hearthisExportStatus: z.literal('pending'),
})

const meSoundExportRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/me/sound/:id/export/hearthis — push this track out to the
  // caller's own hearthis.at account, via their installed hearthis-export credential.
  fastify.post(
    '/api/me/sound/:id/export/hearthis',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        summary: 'Queue hearthis.at export for a sound',
        description:
          'Sound-scoped ExportProvider submit (see GET /api/me/export-plugins hearthis-export). Requires installed hearthis-export integration credentials.',
        response: openApiResponse(HearthisExportQueuedSchema, 'HearthisExportQueued'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const result = await submitHearthisSoundExport(fastify.prisma, user.id, routeParams.id)
      if (!result.ok) return reply.status(result.status).send({ error: result.error })

      return reply.status(202).send({
        soundId: result.soundId,
        hearthisExportStatus: result.hearthisExportStatus,
      })
    },
  )
}

export default meSoundExportRoutes
