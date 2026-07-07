// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { createHash } from 'node:crypto'
import {
  SubmitContentReportResponseSchema,
  SubmitContentReportSchema,
  clientIpFromHeaders,
  openApiResponse,
} from '@tahti/shared'
import { config } from '../../config.js'

// Platform-level abuse-report queue — previously entirely missing (only artist-side
// chat moderation existed via ChatBan/ChannelModerator). No account required to
// report, matching the anonymous-by-default listener model elsewhere in the product.
function dailySalt(): string {
  const day = new Date().toISOString().slice(0, 10)
  return createHash('sha256').update(`${config.internalSecret}:${day}`).digest('hex')
}

const reportsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/v1/reports',
    {
      schema: {
        tags: ['reports'],
        description:
          'Report a channel, release, archive item, or collection for review (auth optional)',
        response: openApiResponse(SubmitContentReportResponseSchema, 'SubmitContentReportResponse'),
      },
    },
    async (request, reply) => {
      const parsed = SubmitContentReportSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }
      const { targetType, targetId, reason, details } = parsed.data

      const clientIp = clientIpFromHeaders(request.headers, request.ip ?? '')
      const reporterIpHash = createHash('sha256').update(`${clientIp}:${dailySalt()}`).digest('hex')

      const report = await fastify.prisma.contentReport.create({
        data: {
          targetType,
          targetId,
          reason,
          details: details ?? null,
          reporterIpHash,
        },
      })

      return reply.status(201).send({ ok: true as const, reportId: report.id.toString() })
    },
  )
}

export default reportsRoute
