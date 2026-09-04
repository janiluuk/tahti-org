// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  ExportPluginProviderListSchema,
  IdParamSchema,
  RevelatorReleaseStatusSchema,
  RevelatorSubmitAcceptedSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { EXPORT_PLUGIN_PROVIDERS } from '../../lib/export-plugin-providers.js'
import { getRevelatorReleaseStatus, submitRevelatorRelease } from '../../lib/revelator-delivery.js'

const ExportProviderReleaseParamsSchema = IdParamSchema.extend({
  provider: z.string().min(1),
})

/**
 * Versioned export-provider registry plus thin aliases that ExportProvider
 * clients can call with a uniform `/api/me/export-plugins/:provider/...` shape.
 * Canonical Revelator routes remain under `/api/me/releases/:id/revelator*`.
 */
const meExportPluginRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/export-plugins',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Versioned export-provider capabilities for external clients',
        response: openApiResponse(ExportPluginProviderListSchema, 'ExportPluginProviderList'),
      },
    },
    async (_request, reply) => reply.send({ providers: EXPORT_PLUGIN_PROVIDERS }),
  )

  fastify.get(
    '/api/me/export-plugins/:provider/releases/:id/status',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: 'ExportProvider status alias (delegates to provider-specific status)',
        response: openApiResponse(RevelatorReleaseStatusSchema, 'RevelatorReleaseStatus'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ExportProviderReleaseParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      if (routeParams.provider !== 'revelator') {
        return reply.status(404).send({ error: 'Unknown export provider' })
      }

      const result = await getRevelatorReleaseStatus(fastify.prisma, user.id, routeParams.id)
      if (!result.ok) return reply.status(404).send({ error: 'Release not found' })

      return reply.send({
        revelatorId: result.revelatorId,
        revelatorStatus: result.revelatorStatus,
        title: result.title,
      })
    },
  )

  fastify.post(
    '/api/me/export-plugins/:provider/releases/:id/submit',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: 'ExportProvider submit alias (delegates to provider-specific submit)',
        response: openApiResponses([
          { status: 202, schema: RevelatorSubmitAcceptedSchema, name: 'RevelatorSubmitAccepted' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ExportProviderReleaseParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      if (routeParams.provider !== 'revelator') {
        return reply.status(404).send({ error: 'Unknown export provider' })
      }

      const result = await submitRevelatorRelease(fastify.prisma, user.id, routeParams.id)
      if (!result.ok) {
        return reply.status(result.status).send({
          error: result.error,
          ...(result.revelatorStatus !== undefined
            ? { revelatorStatus: result.revelatorStatus, revelatorId: result.revelatorId }
            : {}),
        })
      }

      return reply.status(202).send({
        releaseId: result.releaseId,
        revelatorStatus: result.revelatorStatus,
      })
    },
  )
}

export default meExportPluginRoutes
