// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { IdParamSchema, parseRouteParams } from '@tahti/shared'
import { getUserIntegrationCredential } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'
import { enqueueHearthisExport } from '../../lib/queue.js'

const meSoundExportRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/me/sound/:id/export/hearthis — push this track out to the
  // caller's own hearthis.at account, via their installed hearthis-export credential.
  fastify.post(
    '/api/me/sound/:id/export/hearthis',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const credential = await getUserIntegrationCredential(
        fastify.prisma,
        user.id,
        'hearthis-export',
      )
      if (!credential) {
        return reply.status(400).send({ error: 'Install the hearthis.at export plugin first' })
      }

      const item = await fastify.prisma.sound.findFirst({
        where: { id: routeParams.id, channel: { userId: user.id } },
        select: { id: true, hearthisExportStatus: true, rawKey: true, mp3Key: true, flacKey: true },
      })
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })
      if (!item.rawKey && !item.mp3Key && !item.flacKey) {
        return reply.status(400).send({ error: 'This track has no audio file to export' })
      }
      if (item.hearthisExportStatus === 'pending' || item.hearthisExportStatus === 'submitted') {
        return reply.status(409).send({ error: 'Export already in progress' })
      }

      await fastify.prisma.sound.update({
        where: { id: item.id },
        data: { hearthisExportStatus: 'pending' },
      })
      await enqueueHearthisExport(item.id)

      return reply.status(202).send({ soundId: item.id, hearthisExportStatus: 'pending' })
    },
  )
}

export default meSoundExportRoutes
