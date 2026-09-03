// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminDiscordBotSettingsSchema,
  UpdateDiscordBotSettingsSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import {
  resolveDiscordBotCredentials,
  saveDiscordBotSettings,
  toSettingsView,
} from '../../lib/discord-bot-settings.js'

const adminDiscordBotRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/discord-bot',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description:
          'Tahti Radio Discord bot application ID and whether a bot token is stored. Never returns the token.',
        response: openApiResponse(AdminDiscordBotSettingsSchema, 'AdminDiscordBotSettings'),
      },
    },
    async (_request, reply) => {
      const resolved = await resolveDiscordBotCredentials(fastify.prisma)
      return reply.send(toSettingsView(resolved))
    },
  )

  fastify.put(
    '/api/admin/discord-bot',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description:
          'Save Discord application ID and optional bot token. Omit token to keep the current secret.',
        body: {
          type: 'object',
          required: ['clientId'],
          properties: {
            clientId: {
              type: 'string',
              pattern: '^\\d{17,20}$',
              description: 'Discord application / client ID (snowflake)',
            },
            token: {
              type: 'string',
              minLength: 20,
              description: 'Bot token. Omit to keep the currently stored secret.',
            },
          },
        },
        response: openApiResponse(AdminDiscordBotSettingsSchema, 'AdminDiscordBotSettings'),
      },
    },
    async (request, reply) => {
      const parsed = UpdateDiscordBotSettingsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      try {
        const view = await saveDiscordBotSettings(fastify.prisma, {
          clientId: parsed.data.clientId,
          token: parsed.data.token,
          updatedById: request.sessionUser!.id,
        })
        return reply.send(view)
      } catch (error) {
        if (error instanceof Error && error.message === 'TOKEN_REQUIRED') {
          return reply.status(400).send({
            error: 'Bot token is required the first time these settings are saved',
          })
        }
        throw error
      }
    },
  )
}

export default adminDiscordBotRoutes
