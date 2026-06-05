// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  RevelatorReleaseStatusSchema,
  RevelatorSubmitAcceptedSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { releaseCatalogSelect } from '../../lib/release-catalog.js'
import { mediaQueue } from '../../lib/queue.js'

const SUBMITTABLE_STATUSES = new Set(['failed', null])

// M7 — Revelator DSP submission (wizard entry point)
const revelatorRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/releases/:id/revelator',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: 'M7: Revelator submission status for a release',
        response: openApiResponse(RevelatorReleaseStatusSchema, 'RevelatorReleaseStatus'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const release = await fastify.prisma.release.findFirst({
        where: { id, userId: user.id },
        select: {
          revelatorId: true,
          revelatorStatus: true,
          title: true,
        },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      return reply.send({
        revelatorId: release.revelatorId,
        revelatorStatus: release.revelatorStatus,
        title: release.title,
      })
    },
  )

  fastify.post(
    '/api/me/releases/:id/revelator/submit',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: 'M7: queue Revelator DSP delivery for a release',
        response: openApiResponses([
          { status: 202, schema: RevelatorSubmitAcceptedSchema, name: 'RevelatorSubmitAccepted' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const release = await fastify.prisma.release.findFirst({
        where: { id, userId: user.id },
        select: {
          ...releaseCatalogSelect,
          revelatorStatus: true,
          revelatorId: true,
        },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      if (release.tracks.length < 1) {
        return reply.status(400).send({ error: 'Add at least one track before DSP submit' })
      }

      const hasIdentifier =
        Boolean(release.upc?.trim()) || release.tracks.every((t) => Boolean(t.isrc?.trim()))
      if (!hasIdentifier) {
        return reply.status(400).send({
          error: 'Add a UPC or ISRC on every track before DSP submit',
        })
      }

      if (release.revelatorStatus && !SUBMITTABLE_STATUSES.has(release.revelatorStatus)) {
        return reply.status(409).send({
          error: 'Release already submitted to Revelator',
          revelatorStatus: release.revelatorStatus,
          revelatorId: release.revelatorId,
        })
      }

      await fastify.prisma.release.update({
        where: { id },
        data: { revelatorStatus: 'pending' },
      })

      await mediaQueue.add('revelator-deliver', { releaseId: id })

      return reply.status(202).send({ releaseId: id, revelatorStatus: 'pending' as const })
    },
  )
}

export default revelatorRoutes
