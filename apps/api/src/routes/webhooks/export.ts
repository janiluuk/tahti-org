// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { ExportWebhookAcceptedSchema, openApiResponse, parseRouteParams } from '@tahti/shared'
import { config } from '../../config.js'
import { EXPORT_PLUGIN_PROVIDERS } from '../../lib/export-plugin-providers.js'

const ProviderParamSchema = z.object({
  provider: z.string().min(1),
})

function exportWebhookAuthorized(request: { headers: Record<string, unknown> }): boolean {
  const auth = request.headers.authorization
  if (typeof auth === 'string' && auth === `Bearer ${config.internalSecret}`) {
    return true
  }

  const headerSecret = request.headers['x-tahti-webhook-secret']
  if (typeof headerSecret === 'string' && headerSecret === config.internalSecret) {
    return true
  }

  return false
}

/**
 * Provider callback receiver for ExportProvider webhooks.
 * Full Revelator status sync is not wired yet — accept, log, and ack so
 * Nuclear clients and provider sandboxes have a stable URL.
 */
const exportWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/webhooks/export/:provider',
    {
      schema: {
        tags: ['webhooks'],
        description:
          'Export provider callback (INTERNAL_SECRET Bearer or X-Tahti-Webhook-Secret). Currently accepts and logs.',
        response: openApiResponse(ExportWebhookAcceptedSchema, 'ExportWebhookAccepted'),
      },
    },
    async (request, reply) => {
      if (!exportWebhookAuthorized(request)) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      const routeParams = parseRouteParams(ProviderParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const known = EXPORT_PLUGIN_PROVIDERS.some(
        (provider) => provider.id === routeParams.provider && provider.capabilities.webhook,
      )
      if (!known) {
        return reply.status(404).send({ error: 'Unknown export provider' })
      }

      request.log.info(
        {
          provider: routeParams.provider,
          bodyKeys:
            request.body && typeof request.body === 'object'
              ? Object.keys(request.body as object)
              : [],
        },
        'export provider webhook accepted (stub)',
      )

      return reply.send({
        ok: true as const,
        provider: routeParams.provider,
        accepted: true as const,
      })
    },
  )
}

export default exportWebhookRoutes
