// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { ListenHeartbeatBodySchema, clientIpFromHeaders } from '@tahti/shared'
import { config } from '../../config.js'
import { countryFromIp } from '../../lib/geoip.js'

function dailySalt(): string {
  const day = new Date().toISOString().slice(0, 10)
  return createHash('sha256').update(`${config.internalSecret}:${day}`).digest('hex')
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

// Listen-time tracking: how many minutes people listen, broken down by
// source surface (channel page / Tahti Radio / artist profile / discover /
// library / embed) and geographic origin (country, via the same geoip
// lookup Download uses). Session-based, deliberately relaxed polling (not
// per-second/per-minute): the client pings "still listening" every 3 min;
// this either extends the caller's current open ListenSession (lastSeenAt)
// or opens a new one. There is no explicit "stop" call — the
// listen-session-close cron closes any session that stops pinging, so a
// dropped tab/connection still gets a real endedAt within a few minutes,
// and "minutes listened" is always a plain
// (endedAt - startedAt) on the closed row.
const listenHeartbeatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/v1/listen/heartbeat',
    { schema: { response: { 204: { type: 'null' } } } },
    async (request, reply) => {
      const parsed = ListenHeartbeatBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }
      const body = parsed.data

      let channelId: string | null = null
      if (body.archiveItemId) {
        const item = await fastify.prisma.archiveItem.findUnique({
          where: { id: body.archiveItemId },
          select: { channelId: true },
        })
        channelId = item?.channelId ?? null
      }
      if (!channelId && body.channelSlug) {
        const channel = await fastify.prisma.channel.findUnique({
          where: { slug: body.channelSlug },
          select: { id: true },
        })
        channelId = channel?.id ?? null
      }
      if (!channelId) {
        // Not worth erroring the player over — a stale/deleted track shouldn't
        // interrupt playback, it just means this tick isn't tracked.
        return reply.status(204).send()
      }

      const salt = dailySalt()
      const clientIp = clientIpFromHeaders(request.headers, request.ip ?? '')
      const fingerprintInput = body.fp?.trim() || `${request.headers['user-agent'] ?? 'unknown'}`
      const byFingerprint = sha256(`${fingerprintInput}:${salt}`)
      const now = new Date()

      const open = await fastify.prisma.listenSession.findFirst({
        where: {
          byFingerprint,
          channelId,
          archiveItemId: body.archiveItemId ?? null,
          endedAt: null,
        },
        orderBy: { lastSeenAt: 'desc' },
        select: { id: true },
      })

      if (open) {
        await fastify.prisma.listenSession.update({
          where: { id: open.id },
          data: { lastSeenAt: now },
        })
      } else {
        await fastify.prisma.listenSession.create({
          data: {
            channelId,
            archiveItemId: body.archiveItemId ?? null,
            byUserId: request.sessionUser?.id ?? null,
            byFingerprint,
            byIpHash: sha256(`${clientIp}:${salt}`),
            countryCode: countryFromIp(clientIp),
            source: body.source,
            startedAt: now,
            lastSeenAt: now,
          },
        })
      }

      return reply.status(204).send()
    },
  )
}

export default listenHeartbeatRoutes
