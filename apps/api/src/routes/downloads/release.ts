// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { createHash } from 'node:crypto'
import { presignedGetUrl } from '../../lib/minio.js'
import { isActiveFanSubscriber } from '../../lib/fansub.js'
import {
  DownloadUrlResponseSchema,
  ReleaseDownloadQuerySchema,
  ReleaseTrackDownloadParamsSchema,
  clientIpFromHeaders,
  evaluateDownloadCountPolicy,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { config } from '../../config.js'
import { getDownloadNoCountCidrs } from '../../lib/download-no-count-cidrs.js'
import { downloadRateLimits } from '../../lib/download-limits.js'
import { countryFromIp } from '../../lib/geoip.js'

// M18 — public release-track downloads with the same anti-fraud stack as
// archive-item downloads. Reuses the Download table (releaseTrackId column).

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const DEDUP_WINDOW_MS = 30 * DAY_MS
const PER_TRACK_CAP = 10

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
    {
      schema: {
        tags: ['downloads'],
        description: 'M18: presigned release-track download with anti-fraud accounting',
        response: openApiResponse(DownloadUrlResponseSchema, 'DownloadUrl'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(ReleaseTrackDownloadParamsSchema, request.params)
      if (!routeParams) {
        return reply.status(400).send({ error: 'Invalid path parameters' })
      }
      const { smartLinkSlug, trackId } = routeParams
      const parsedQuery = ReleaseDownloadQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: parsedQuery.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const query = parsedQuery.data

      const release = await fastify.prisma.release.findFirst({
        where: { smartLinkSlug, state: 'PUBLISHED' },
        select: { id: true, userId: true, user: { select: { tier: true } } },
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

      const artistPaid = release.user.tier !== 'FREE'
      const canFlac = Boolean(track.flacKey) && (isFanSub || artistPaid)
      const wantSource = query.format === 'source'
      const wantFlac = query.format === 'flac'

      if (wantSource && !isFanSub) {
        return reply
          .status(403)
          .send({ error: 'Original source download requires an active fan subscription' })
      }
      if (wantFlac && !canFlac) {
        return reply.status(403).send({
          error: isFanSub
            ? 'FLAC is not available for this track'
            : 'FLAC download requires membership or a fan subscription',
        })
      }
      if (wantSource && !track.sourceKey) {
        return reply
          .status(409)
          .send({ error: 'Original source file not available for this track' })
      }

      const objectKey = wantSource
        ? track.sourceKey!
        : wantFlac
          ? track.flacKey!
          : (track.streamKey ?? track.sourceKey)

      if (!objectKey) return reply.status(409).send({ error: 'Track file not available yet' })

      const servedFormat = wantSource ? 'source' : wantFlac ? 'flac' : 'opus'

      // Anti-fraud — same logic as archive downloads
      const salt = dailySalt()
      const clientIp = clientIpFromHeaders(request.headers, request.ip ?? '')
      const fpInput = query.fp?.trim() || (request.headers['user-agent'] ?? 'unknown')
      const byFingerprint = sha256(`${fpInput}:${salt}`)
      const byIpHash = sha256(`${clientIp}:${salt}`)

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

      const { perHour, perDay } = downloadRateLimits()
      if (lastHour >= perHour || lastDay >= perDay) {
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
        const policy = evaluateDownloadCountPolicy({
          clientIp,
          userAgent: request.headers['user-agent'],
          noCountCidrs: await getDownloadNoCountCidrs(),
          trustOverrideIps: config.download.trustOverrideIps,
        })
        if (!policy.shouldCount) {
          countedAt = null
          reason = policy.reason
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
          format: wantSource ? 'source' : wantFlac ? 'flac' : 'opus256',
          byUserId,
          byFingerprint,
          byIpHash,
          countryCode: countryFromIp(clientIp),
          bytes: 0,
          countedAt,
          reason,
          weight,
        },
      })

      const url = await presignedGetUrl(objectKey, 300)
      return reply.send({ url, format: servedFormat, counted: countedAt !== null })
    },
  )
}

export default releaseDownloadRoutes
