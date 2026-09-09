// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  DiscordBotHeartbeatAckSchema,
  DiscordBotHeartbeatSchema,
  InternalDiscordBotCredentialsSchema,
  openApiResponse,
} from '@tahti/shared'
import { config } from '../../config.js'
import { resolveDiscordBotCredentials } from '../../lib/discord-bot-settings.js'
import { recordDiscordBotHeartbeat } from '../../lib/discord-bot-heartbeat.js'

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

  fastify.post(
    '/api/v1/internal/discord-bot/heartbeat',
    {
      schema: {
        tags: ['internal'],
        description: 'Discord bot self-reports liveness. INTERNAL_SECRET only.',
        body: {
          type: 'object',
          required: ['guildCount', 'uptimeSecs'],
          properties: {
            guildCount: { type: 'integer', minimum: 0 },
            uptimeSecs: { type: 'integer', minimum: 0 },
            currentTrack: { type: 'string', nullable: true },
          },
        },
        response: openApiResponse(DiscordBotHeartbeatAckSchema, 'DiscordBotHeartbeatAck'),
      },
    },
    async (request, reply) => {
      if (!requireInternalAuth(request.headers.authorization)) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      const parsed = DiscordBotHeartbeatSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      await recordDiscordBotHeartbeat({
        guildCount: parsed.data.guildCount,
        uptimeSecs: parsed.data.uptimeSecs,
        currentTrack: parsed.data.currentTrack ?? null,
      })

      return reply.send({ ok: true as const })
    },
  )
}

export default internalDiscordBotRoutes
