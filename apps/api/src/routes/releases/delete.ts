// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { IdParamSchema, parseRouteParams } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { compactCollectionPositions } from '../collections/helpers.js'

const releaseDeleteRoutes: FastifyPluginAsync = async (fastify) => {
  // DELETE /api/me/releases/:id — remove a release the artist owns. Its
  // tracklist, smart-link clicks and royalty reports go with it; uploaded
  // sounds stay. Playlist entries that only pointed at the release are
  // removed rather than left empty.
  fastify.delete(
    '/api/me/releases/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description:
          'Delete an own release; refused once it has been sent for distribution. Sounds are kept.',
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const release = await fastify.prisma.release.findFirst({
        where: { id: routeParams.id, userId: user.id },
        select: { id: true, revelatorId: true },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })
      if (release.revelatorId) {
        return reply.status(409).send({
          error:
            'This release has been sent for distribution — withdraw it from stores before deleting it.',
        })
      }

      await fastify.prisma.$transaction(async (tx) => {
        const where = { releaseId: release.id, soundId: null }
        const affected = await tx.collectionItem.findMany({
          where,
          distinct: ['collectionId'],
          select: { collectionId: true },
        })
        await tx.collectionItem.deleteMany({ where })
        await tx.release.delete({ where: { id: release.id } })
        for (const { collectionId } of affected) {
          await compactCollectionPositions(tx, collectionId)
        }
      })
      return reply.status(204).send()
    },
  )
}

export default releaseDeleteRoutes
