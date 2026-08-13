// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { config } from '../config.js'
import { renderPublicApiDocsHtml, toPublicOpenApi } from '../lib/public-openapi.js'

/**
 * Public, unauthenticated API docs (Scalar + OpenAPI JSON).
 * Canonical entry: `https://api.tahti.live/` (also `/api`).
 * Ops full Swagger UI stays at `/docs` behind basic auth.
 */
const publicApiDocsRoute: FastifyPluginAsync = async (fastify) => {
  const openapiPath = '/api/openapi.json'

  async function sendDocsHtml(_request: FastifyRequest, reply: FastifyReply) {
    return reply
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'public, max-age=60')
      .send(renderPublicApiDocsHtml(openapiPath))
  }

  // Apex of the API host — what people expect when they open api.tahti.live
  for (const path of ['/', '/api', '/api/'] as const) {
    fastify.get(
      path,
      {
        schema: {
          tags: ['compliance'],
          hide: true,
          description: 'Public API reference (Scalar UI)',
        },
      },
      sendDocsHtml,
    )
  }

  fastify.get(
    openapiPath,
    {
      schema: {
        tags: ['compliance'],
        hide: true,
        description: 'Public OpenAPI 3 document (admin/internal routes omitted)',
      },
    },
    async (_request, reply) => {
      const full = fastify.swagger() as Parameters<typeof toPublicOpenApi>[0]
      const publicSpec = toPublicOpenApi(full, {
        serverUrl: config.apiUrl,
        generatedAt: new Date().toISOString(),
      })
      return reply
        .type('application/json; charset=utf-8')
        .header('Cache-Control', 'public, max-age=60')
        .header('Access-Control-Allow-Origin', '*')
        .send(publicSpec)
    },
  )
}

export default publicApiDocsRoute
