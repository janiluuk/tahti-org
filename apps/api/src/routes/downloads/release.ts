// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { createHash } from 'node:crypto'
import { presignedGetUrl } from '../../lib/minio.js'
import { isActiveFanSubscriber } from '../../lib/fansub.js'
import { config } from '../../config.js'

// M18 — public release-track downloads with the same anti-fraud stack as
// archive-item downloads. Reuses the Download table (releaseTrackId column).

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const DEDUP_WINDOW_MS = 30 * DAY_MS
const PER_TRACK_CAP = 10
const RATE_PER_HOUR = 5
const RATE_PER_DAY = 20

function dailySalt(): string {
  const day = new Date().toISOString().slice(0, 10)
  return createHash('sha256').update(`${config.internalSecret}:${day}`).digest('hex')
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

const releaseDownloadRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/releases/:smartLinkSlug/tracks/:trackId/download
  fastify.get(
    '/api/v1/releases/:smartLinkSlug/tracks/:trackId/download',
    async (request, reply) => {
      const { smartLinkSlug, trackId } = request.params as {
        smartLinkSlug: string
        trackId: string
      }
      const query = request.query as { fp?: string; format?: string }

      const release = await fastify.prisma.release.findFirst({
        where: { smartLinkSlug, state: 'PUBLISHED' },
        select: { id: true, userId: true },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      const track = await fastify.prisma.releaseTrack.findFirst({
        where: { id: trackId, releaseId: release.id, status: 'READY' },
        select: {
          id: true,
          streamKey: true,
          flacKey: true,
          sourceKey: true,
          explicit: true,
        },
      })
      if (!track) return reply.status(404).send({ error: 'Track not found or not ready' })

      // Resolve the download key by format + subscriber status
      const byUserId = request.sessionUser?.id ?? null
      const isFanSub =
        byUserId && (await isActiveFanSubscriber(fastify.prisma, release.userId, byUserId))

      const wantFlac = query.format === 'flac'
      if (wantFlac && !isFanSub) {
        return reply
          .status(403)
          .send({ error: 'FLAC download requires an active fan subscription' })
      }

      const objectKey = wantFlac
        ? (track.flacKey ?? track.sourceKey)
        : (track.streamKey ?? track.sourceKey)

      if (!objectKey) return reply.status(409).send({ error: 'Track file not available yet' })

      // Anti-fraud — same logic as archive downloads
      const salt = dailySalt()
      const fpInput = query.fp?.trim() || (request.headers['user-agent'] ?? 'unknown')
      const byFingerprint = sha256(`${fpInput}:${salt}`)
      const byIpHash = sha256(`${request.ip}:${salt}`)

      const now = Date.now()
      const [lastHour, lastDay] = await Promise.all([
        fastify.prisma.download.count({
          where: {
            createdAt: { gte: new Date(now - HOUR_MS) },
            OR: [{ byFingerprint }, { byIpHash }],
          },
        }),
        fastify.prisma.download.count({
          where: {
            createdAt: { gte: new Date(now - DAY_MS) },
            OR: [{ byFingerprint }, { byIpHash }],
          },
        }),
      ])

      if (lastHour >= RATE_PER_HOUR || lastDay >= RATE_PER_DAY) {
        return reply
          .header('Retry-After', '3600')
          .status(429)
          .send({ error: 'Download rate limit exceeded. Try again later.' })
      }

      const weight = isFanSub ? 5 : 1

      let countedAt: Date | null = new Date()
      let reason: string | null = null

      const dedupHit = await fastify.prisma.download.findFirst({
        where: {
          releaseTrackId: track.id,
          byFingerprint,
          countedAt: { gte: new Date(now - DEDUP_WINDOW_MS) },
        },
        select: { id: true },
      })
      if (dedupHit) {
        countedAt = null
        reason = 'dedup'
      } else {
        const countedForTrack = await fastify.prisma.download.count({
          where: { releaseTrackId: track.id, byFingerprint, countedAt: { not: null } },
        })
        if (countedForTrack >= PER_TRACK_CAP) {
          countedAt = null
          reason = 'per_track_cap'
        }
      }

      if (countedAt) {
        const ipFirstSeen = await fastify.prisma.download.findFirst({
          where: { byIpHash },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        })
        if (!ipFirstSeen || now - ipFirstSeen.createdAt.getTime() < DAY_MS) {
          countedAt = null
          reason = 'new_ip'
        }
      }

      // channelId is required by the Download model — use null via the artist's channel
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: release.userId },
        select: { id: true },
      })

      await fastify.prisma.download.create({
        data: {
          channelId: channel?.id ?? '',
          releaseTrackId: track.id,
          format: wantFlac ? 'flac' : 'opus256',
          byUserId,
          byFingerprint,
          byIpHash,
          bytes: 0,
          countedAt,
          reason,
          weight,
        },
      })

      const url = await presignedGetUrl(objectKey, 300)
      return reply.send({ url, format: wantFlac ? 'flac' : 'opus', counted: countedAt !== null })
    },
  )
}

export default releaseDownloadRoutes
