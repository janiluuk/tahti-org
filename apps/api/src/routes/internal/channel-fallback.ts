// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChannelIdParamSchema,
  FallbackM3uBodySchema,
  PlainTextErrorSchema,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { config } from '../../config.js'
import { presignedGetUrl } from '../../lib/minio.js'
import { archivePlaybackKey, buildFallbackPlaybackRows, renderFallbackM3u } from '@tahti/shared'
import type { FallbackM3uEntry, FallbackPlaybackRow } from '@tahti/shared'

// reload_mode="rounds" in the Liquidsoap template means the playlist can go a long
// time between refetches for a small pool (300 rounds through a handful of tracks),
// so the presigned URLs handed out here need to comfortably outlive that — a short
// TTL would silently start 403ing again mid-rotation, exactly like the bug this
// replaced (tahti/mp3 isn't publicly readable, unlike covers/avatars/archive banners).
const FALLBACK_URL_TTL_SEC = 24 * 60 * 60

async function toM3uEntries(rows: FallbackPlaybackRow[]): Promise<FallbackM3uEntry[]> {
  return Promise.all(
    rows.map(async (row) => ({
      title: row.title,
      durationSec: row.durationSec,
      url: await presignedGetUrl(row.playbackKey, FALLBACK_URL_TTL_SEC),
    })),
  )
}

// Liquidsoap calls this to get the current fallback playlist for a channel.
// Returns an extended M3U with presigned HTTP URLs to archive playback files (MP3 or FLAC).
const channelFallbackRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/internal/channels/:channelId/fallback.m3u',
    {
      schema: {
        tags: ['internal'],
        response: openApiResponses([
          { status: 200, schema: FallbackM3uBodySchema, name: 'FallbackM3uBody' },
          { status: 401, schema: PlainTextErrorSchema, name: 'PlainTextError' },
          { status: 404, schema: PlainTextErrorSchema, name: 'PlainTextError' },
        ]),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(ChannelIdParamSchema, request.params)
      if (!routeParams) return reply.status(401).send('invalid path')
      const { channelId } = routeParams

      // Liquidsoap's playlist() fetches a bare URL and can't attach an Authorization
      // header, so it authenticates via a ?secret= query param instead. Every other
      // internal caller keeps using the header.
      const auth = (request.headers['authorization'] as string | undefined) ?? ''
      const secretParam = (request.query as { secret?: string } | undefined)?.secret ?? ''
      const authorized =
        auth === `Bearer ${config.internalSecret}` || secretParam === config.internalSecret
      if (!authorized) {
        return reply.status(401).send('unauthorized')
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { id: channelId },
        select: { fallbackMode: true, fallbackEnabled: true },
      })
      if (!channel) {
        return reply.status(404).send('channel not found')
      }

      if (!channel.fallbackEnabled) {
        const body = renderFallbackM3u([])
        return reply.header('Content-Type', 'audio/x-mpegurl').send(body)
      }

      // Curated channels (e.g. Tahti Selects) have an explicit, ordered, cross-channel
      // playlist instead of the regular per-channel isFallback/fallbackOrder rotation.
      // Every other channel has zero CuratedRotationItem rows, so this is additive only.
      const curated = await fastify.prisma.curatedRotationItem.findMany({
        where: { channelId },
        orderBy: { position: 'asc' },
        select: {
          archiveItem: {
            select: { id: true, title: true, mp3Key: true, flacKey: true, durationSec: true },
          },
        },
      })

      if (curated.length > 0) {
        const rows: FallbackPlaybackRow[] = []
        for (const { archiveItem } of curated) {
          const playbackKey = archivePlaybackKey(archiveItem)
          if (!playbackKey) continue
          rows.push({
            id: archiveItem.id,
            title: archiveItem.title,
            playbackKey,
            durationSec: archiveItem.durationSec,
          })
        }
        const body = renderFallbackM3u(await toM3uEntries(rows))
        return reply.header('Content-Type', 'audio/x-mpegurl').send(body)
      }

      const items = await fastify.prisma.archiveItem.findMany({
        where: {
          channelId,
          status: 'READY',
          OR: [{ mp3Key: { not: null } }, { flacKey: { not: null } }],
        },
        select: {
          id: true,
          title: true,
          mp3Key: true,
          flacKey: true,
          durationSec: true,
          isFallback: true,
          fallbackOrder: true,
          lastFallbackPlayedAt: true,
          createdAt: true,
        },
      })

      const rows = buildFallbackPlaybackRows(items, channel.fallbackMode)
      const body = renderFallbackM3u(await toM3uEntries(rows))

      return reply.header('Content-Type', 'audio/x-mpegurl').send(body)
    },
  )
}

export default channelFallbackRoute
