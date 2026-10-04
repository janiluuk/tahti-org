// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  RadioStationSuggestionListSchema,
  RadioStationSuggestionReviewResponseSchema,
  RadioStationSuggestionStatusSchema,
  RejectRadioStationSuggestionSchema,
  openApiResponse,
  parseRouteParams,
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

  // POST …/:id/approve — turn the suggestion into an internet radio preset.
  // The preset starts disabled; the board switches it on from Admin → Radio.
  fastify.post(
    '/api/admin/radio-station-suggestions/:id/approve',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(
          RadioStationSuggestionReviewResponseSchema,
          'RadioStationSuggestionApproved',
        ),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const suggestion = await fastify.prisma.radioStationSuggestion.findUnique({
        where: { id: routeParams.id },
      })
      if (!suggestion) return reply.status(404).send({ error: 'Suggestion not found' })
      if (suggestion.status !== 'PENDING') {
        return reply.status(409).send({ error: 'This suggestion was already reviewed' })
      }
      const description = [
        suggestion.language,
        suggestion.bitrateKbps ? `${suggestion.bitrateKbps} kbps` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      const preset = await fastify.prisma.$transaction(async (tx) => {
        const created = await tx.internetRadioPreset.create({
          data: {
            name: suggestion.name,
            iconUrl: suggestion.logoUrl,
            streamUrl: suggestion.streamUrl,
            description,
            enabled: false,
          },
          select: { id: true },
        })
        await tx.radioStationSuggestion.update({
          where: { id: suggestion.id },
          data: {
            status: 'APPROVED',
            reviewedById: request.sessionUser!.id,
            reviewedAt: new Date(),
            presetId: created.id,
          },
        })
        return created
      })
      return reply.send({ ok: true as const, status: 'APPROVED' as const, presetId: preset.id })
    },
  )

  // POST …/:id/reject { note? } — the note is kept on the suggestion.
  fastify.post(
    '/api/admin/radio-station-suggestions/:id/reject',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(
          RadioStationSuggestionReviewResponseSchema,
          'RadioStationSuggestionRejected',
        ),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = RejectRadioStationSuggestionSchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }
      const suggestion = await fastify.prisma.radioStationSuggestion.findUnique({
        where: { id: routeParams.id },
        select: { status: true },
      })
      if (!suggestion) return reply.status(404).send({ error: 'Suggestion not found' })
      if (suggestion.status !== 'PENDING') {
        return reply.status(409).send({ error: 'This suggestion was already reviewed' })
      }
      await fastify.prisma.radioStationSuggestion.update({
        where: { id: routeParams.id },
        data: {
          status: 'REJECTED',
          rejectionNote: parsed.data.note || null,
          reviewedById: request.sessionUser!.id,
          reviewedAt: new Date(),
        },
      })
      return reply.send({ ok: true as const, status: 'REJECTED' as const, presetId: null })
    },
  )
}

export default adminRadioStationSuggestionRoutes
