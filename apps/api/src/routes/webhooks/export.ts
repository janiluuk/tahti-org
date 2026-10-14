// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  ExportWebhookAcceptedSchema,
  RevelatorExportWebhookBodySchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { config } from '../../config.js'
import { EXPORT_PLUGIN_PROVIDERS } from '../../lib/export-plugin-providers.js'
import { applyRevelatorWebhookStatus } from '../../lib/revelator-delivery.js'

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
 * Revelator: parse body → update Release.revelatorStatus (see applyRevelatorWebhookStatus).
 * Auth is still INTERNAL_SECRET until vendor HMAC docs land.
 */
const exportWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/webhooks/export/:provider',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Export provider delivery webhook',
        description:
          'Export provider callback (INTERNAL_SECRET Bearer or X-Tahti-Webhook-Secret). Revelator updates release delivery status. Answers 200 `{ ok, provider, accepted }`.',
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
        (provider) => provider.id === routeParams.provider && provider.webhookPath != null,
      )
      if (!known) {
        return reply.status(404).send({ error: 'Unknown export provider' })
      }

      if (routeParams.provider === 'revelator') {
        const parsed = RevelatorExportWebhookBodySchema.safeParse(request.body ?? {})
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ error: parsed.error.issues[0]?.message ?? 'Invalid webhook body' })
        }
        const applied = await applyRevelatorWebhookStatus(fastify.prisma, parsed.data)
        if (!applied.ok) {
          return reply.status(applied.status).send({ error: applied.error })
        }
        request.log.info(
          {
            provider: 'revelator',
            releaseId: applied.releaseId,
            revelatorStatus: applied.revelatorStatus,
            applied: applied.applied,
          },
          'revelator export webhook applied',
        )
        return reply.send({
          ok: true as const,
          provider: 'revelator',
          accepted: true as const,
        })
      }

      request.log.info(
        {
          provider: routeParams.provider,
          bodyKeys:
            request.body && typeof request.body === 'object'
              ? Object.keys(request.body as object)
              : [],
        },
        'export provider webhook accepted (no status sync for this provider)',
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
