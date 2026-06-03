// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { createHash } from 'node:crypto'
import { archivePlaybackKey } from '@tahti/shared'
import { presignedGetUrl } from '../../lib/minio.js'
import { isActiveFanSubscriber } from '../../lib/fansub.js'
import { resolveDownloadGateStatus } from '../../lib/download-gates.js'
import { config } from '../../config.js'

// M18 — downloads as a first-class action with engagement-unit accounting.
//
// Anonymous downloads are allowed (no account). Anti-fraud is layered:
//   - rate limit per fingerprint / per IP (5/hour, 20/day)
//   - same-track dedup: a fingerprint counts once per 30 days per item
//   - per-track cap: max 10 counted downloads per fingerprint per item
// A download that doesn't count toward grants still succeeds for the listener;
// it is logged with countedAt = NULL and a `reason`.
//
// Tor/bot allowlist (engagement-and-fansubs.md §6) is deferred.

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

const downloadRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/v1/c/:slug/archive/:itemId/download', async (request, reply) => {
    const { slug, itemId } = request.params as { slug: string; itemId: string }
    const query = request.query as { fp?: string; format?: string }

    const channel = await fastify.prisma.channel.findUnique({
      where: { slug },
      select: { id: true, userId: true, user: { select: { tier: true } } },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    const item = await fastify.prisma.archiveItem.findFirst({
      where: { id: itemId, channelId: channel.id, status: 'READY' },
      select: {
        id: true,
        mp3Key: true,
        flacKey: true,
        fileSizeBytes: true,
        repostToDownload: true,
        followToDownload: true,
      },
    })
    if (!item) return reply.status(404).send({ error: 'Archive item not found' })

    const salt = dailySalt()
    const fingerprintInput = query.fp?.trim() || `${request.headers['user-agent'] ?? 'unknown'}`
    const byFingerprint = sha256(`${fingerprintInput}:${salt}`)
    const byUserId = request.sessionUser?.id ?? null
    const gates = await resolveDownloadGateStatus(fastify.prisma, {
      artistUserId: channel.userId,
      archiveItemId: item.id,
      repostToDownload: item.repostToDownload,
      followToDownload: item.followToDownload,
      byUserId,
      byFingerprint,
      skipGates: byUserId === channel.userId,
    })
    if (!gates.canDownload) {
      const missing: string[] = []
      if (gates.repostRequired && !gates.repostSatisfied) missing.push('repost')
      if (gates.followRequired && !gates.followSatisfied) missing.push('follow')
      return reply.status(403).send({
        error:
          missing.includes('follow') && !byUserId
            ? 'Sign in and follow this artist to download'
            : missing.includes('follow')
              ? 'Follow this artist to download'
              : 'Acknowledge sharing this track to download',
        gates: missing,
      })
    }
    const wantFlac = query.format === 'flac' && item.flacKey && channel.user.tier !== 'FREE'
    const objectKey = wantFlac ? item.flacKey! : archivePlaybackKey(item)
    if (!objectKey) {
      return reply.status(409).send({ error: 'No downloadable file for this item' })
    }
    const servedFlac = wantFlac || (!item.mp3Key && Boolean(item.flacKey))

    const byIpHash = sha256(`${request.ip}:${salt}`)

    // Rate limit by fingerprint OR IP (whichever trips first).
    const now = Date.now()
    const hourAgo = new Date(now - HOUR_MS)
    const dayAgo = new Date(now - DAY_MS)

    const [lastHour, lastDay] = await Promise.all([
      fastify.prisma.download.count({
        where: {
          createdAt: { gte: hourAgo },
          OR: [{ byFingerprint }, { byIpHash }],
        },
      }),
      fastify.prisma.download.count({
        where: {
          createdAt: { gte: dayAgo },
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

    // Determine grant weight. An active fan-subscriber to this artist (M19)
    // gets a 5× paid-download weight; everyone else is a free download.
    const weight =
      byUserId && (await isActiveFanSubscriber(fastify.prisma, channel.userId, byUserId)) ? 5 : 1

    // Decide whether this download counts toward grants.
    let countedAt: Date | null = new Date()
    let reason: string | null = null

    const dedupHit = await fastify.prisma.download.findFirst({
      where: {
        archiveItemId: item.id,
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
        where: { archiveItemId: item.id, byFingerprint, countedAt: { not: null } },
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

    await fastify.prisma.download.create({
      data: {
        channelId: channel.id,
        archiveItemId: item.id,
        format: servedFlac ? 'flac' : query.format === 'opus256' ? 'opus256' : 'mp3_320',
        byUserId,
        byFingerprint,
        byIpHash,
        bytes: Number(item.fileSizeBytes),
        countedAt,
        reason,
        weight,
      },
    })

    const url = await presignedGetUrl(objectKey, 300)
    return reply.send({ url, counted: countedAt !== null })
  })
}

export default downloadRoutes
