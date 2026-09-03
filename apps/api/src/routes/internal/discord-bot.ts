// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { InternalDiscordBotCredentialsSchema, openApiResponse } from '@tahti/shared'
import { config } from '../../config.js'
import { resolveDiscordBotCredentials } from '../../lib/discord-bot-settings.js'

function requireInternalAuth(authHeader: string | undefined): boolean {
  return authHeader === `Bearer ${config.internalSecret}`
}

const internalDiscordBotRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/internal/discord-bot/credentials',
    {
      schema: {
        tags: ['internal'],
        description:
          'Plaintext Discord bot credentials for the Tahti Radio Discord bot process. INTERNAL_SECRET only.',
        response: openApiResponse(
          InternalDiscordBotCredentialsSchema,
          'InternalDiscordBotCredentials',
        ),
      },
    },
    async (request, reply) => {
      if (!requireInternalAuth(request.headers.authorization)) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      const resolved = await resolveDiscordBotCredentials(fastify.prisma)
      if (!resolved) {
        return reply.status(404).send({ error: 'Discord bot credentials are not configured' })
      }

      return reply.send({ clientId: resolved.clientId, token: resolved.token })
    },
  )
}

export default internalDiscordBotRoutes
