// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  RadioStationSuggestionListSchema,
  RadioStationSuggestionStatusSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'

const LIST_LIMIT = 100

/** Board review queue for listener-suggested internet radio stations
 * (Tahti Player: /admin/radio-station-suggestions). */
const adminRadioStationSuggestionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/radio-station-suggestions',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Station suggestions, oldest first; ?status=PENDING|APPROVED|REJECTED',
        response: openApiResponse(RadioStationSuggestionListSchema, 'RadioStationSuggestionList'),
      },
    },
    async (request, reply) => {
      const rawStatus = (request.query as { status?: string }).status
      const status = rawStatus ? RadioStationSuggestionStatusSchema.safeParse(rawStatus) : null
      if (status && !status.success) {
        return reply.status(400).send({ error: 'Invalid status' })
      }
      const rows = await fastify.prisma.radioStationSuggestion.findMany({
        where: status?.success ? { status: status.data } : {},
        orderBy: { createdAt: 'asc' },
        take: LIST_LIMIT,
        include: { submitter: { select: { username: true, displayName: true } } },
      })
      return reply.send({
        items: rows.map((row) => ({
          id: row.id,
          status: row.status,
          rejectionNote: row.rejectionNote,
          createdAt: row.createdAt.toISOString(),
          submitter: row.submitter
            ? {
                username: row.submitter.username,
                displayName: row.submitter.displayName.trim() || row.submitter.username,
              }
            : null,
          name: row.name,
          logoUrl: row.logoUrl,
          language: row.language,
          bitrateKbps: row.bitrateKbps,
          streamUrl: row.streamUrl,
        })),
      })
    },
  )
}

export default adminRadioStationSuggestionRoutes
