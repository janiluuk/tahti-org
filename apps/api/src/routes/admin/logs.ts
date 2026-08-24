// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Board-gated container logs, queried server-to-server from Loki running on
// vimage6 (see infra/docker-compose.stack.yml's x-loki-logging — that's what
// actually ships logs there; this route only reads). Confirmed live and
// reachable from vimage on 2026-08-25, but empty at the time (nothing had
// shipped logs there yet) — the exact `service` label values below (derived
// from the loki-external-labels `{{.Name}}` template, i.e. raw container
// names like "tahti-stack-api-1") are inferred from that config, not
// observed from a real query response yet. Sanity-check the first real
// `service` values once logs are flowing, in case Docker's template
// resolution or sanitization doesn't match this assumption exactly.

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminLogsQuerySchema,
  AdminLogsResponseSchema,
  openApiResponse,
  type AdminLogsEntrySchema,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { config } from '../../config.js'
import type { z } from 'zod'

type LokiStreamResult = {
  stream: Record<string, string>
  values: [string, string][]
}

type LokiQueryRangeResponse = {
  status: string
  data?: { resultType: string; result: LokiStreamResult[] }
}

function escapeLogQlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildLogQlQuery(service: string | undefined, search: string | undefined): string {
  const selector = service
    ? `{job="tahti", service=~".*${escapeLogQlString(service)}.*"}`
    : '{job="tahti"}'
  return search ? `${selector} |= "${escapeLogQlString(search)}"` : selector
}

const adminLogsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/logs',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Board-only: container logs from the vimage6 Loki, filtered by service/search/time',
        response: openApiResponse(AdminLogsResponseSchema, 'AdminLogsResponse'),
      },
    },
    async (request, reply) => {
      const parsed = AdminLogsQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const { service, search, since, until, limit } = parsed.data

      const endMs = until ? new Date(until).getTime() : Date.now()
      // Default to the last hour — a live log viewer, not a historical archive
      // (Loki's own retention/limits_config governs how far back `since` can go).
      const startMs = since ? new Date(since).getTime() : endMs - 60 * 60 * 1000

      const url = new URL('/loki/api/v1/query_range', config.lokiUrl)
      url.searchParams.set('query', buildLogQlQuery(service, search))
      url.searchParams.set('start', String(startMs * 1_000_000))
      url.searchParams.set('end', String(endMs * 1_000_000))
      url.searchParams.set('limit', String(limit))
      url.searchParams.set('direction', 'backward')

      let body: LokiQueryRangeResponse
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
        if (!res.ok) {
          fastify.log.warn({ status: res.status }, 'loki query_range failed')
          return reply.send({ entries: [], lokiReachable: false })
        }
        body = (await res.json()) as LokiQueryRangeResponse
      } catch (err) {
        fastify.log.warn(err, 'loki query_range unreachable')
        return reply.send({ entries: [], lokiReachable: false })
      }

      const entries: z.infer<typeof AdminLogsEntrySchema>[] = []
      for (const stream of body.data?.result ?? []) {
        const svc = stream.stream.service ?? stream.stream.container_name ?? 'unknown'
        for (const [tsNs, line] of stream.values) {
          entries.push({
            timestampMs: Math.floor(Number(tsNs) / 1_000_000),
            service: svc,
            line,
          })
        }
      }
      entries.sort((a, b) => a.timestampMs - b.timestampMs)

      return reply.send({ entries, lokiReachable: true })
    },
  )
}

export default adminLogsRoutes
