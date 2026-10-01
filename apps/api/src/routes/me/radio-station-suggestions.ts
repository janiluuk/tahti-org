// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  CreateRadioStationSuggestionSchema,
  MAX_PENDING_RADIO_STATION_SUGGESTIONS,
  RadioStationSuggestionCreatedSchema,
  openApiResponses,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

/** Listeners suggest internet radio stations for the board-curated presets
 * (Tahti Player: Add-ons → Radio → Suggest a station). */
const meRadioStationSuggestionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/me/radio-station-suggestions',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['internet-radio'],
        description: 'Suggest an internet radio station for the board to review',
        response: openApiResponses([
          {
            status: 201,
            schema: RadioStationSuggestionCreatedSchema,
            name: 'RadioStationSuggestionCreated',
          },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = CreateRadioStationSuggestionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }
      const user = request.sessionUser!
      const pending = await fastify.prisma.radioStationSuggestion.count({
        where: { submitterId: user.id, status: 'PENDING' },
      })
      if (pending >= MAX_PENDING_RADIO_STATION_SUGGESTIONS) {
        return reply.status(429).send({
          error: `You already have ${MAX_PENDING_RADIO_STATION_SUGGESTIONS} suggestions waiting for review`,
        })
      }
      const duplicate = await fastify.prisma.radioStationSuggestion.findFirst({
        where: { streamUrl: parsed.data.streamUrl, status: { in: ['PENDING', 'APPROVED'] } },
        select: { id: true },
      })
      if (duplicate) {
        return reply.status(409).send({ error: 'That stream has already been suggested' })
      }
      const suggestion = await fastify.prisma.radioStationSuggestion.create({
        data: {
          submitterId: user.id,
          name: parsed.data.name,
          logoUrl: parsed.data.logoUrl ?? null,
          language: parsed.data.language,
          bitrateKbps: parsed.data.bitrateKbps ?? null,
          streamUrl: parsed.data.streamUrl,
        },
        select: { id: true, status: true },
      })
      return reply.status(201).send(suggestion)
    },
  )
}

export default meRadioStationSuggestionRoutes
