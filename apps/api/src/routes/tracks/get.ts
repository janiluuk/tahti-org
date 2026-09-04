// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  PublicTrackDetailSchema,
  soundPlaybackKey,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { presignedGetUrl } from '../../lib/minio.js'
import { serializeSound } from '../../lib/sound-metadata.js'
import { resolvePlaybackGateStatus } from '../../lib/purchase-tiers.js'

// GET /api/tracks/:id — public, no auth required. Full detail for a
// standalone track page reached anywhere a track id travels without its
// originating channel (favorites, an artist's catalog, a shared link) —
// unlike GET /api/channels/:slug/items, which only ever serves a list
// already scoped to one known channel.
//
// Access: FREE streams for everyone; SUBSCRIBERS_ONLY / PURCHASE null
// `audioUrl` and set `gate` when the viewer is not entitled (artist and
// active fan-subscribers always pass). Tier name/price are included so
// the Tahti Player buy CTA can render without a second request.
const trackGetRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/tracks/:id',
    {
      schema: {
        tags: ['discover'],
        description:
          'Public single-track detail — metadata, waveform peaks, and purchase/subscriber gate',
        response: openApiResponse(PublicTrackDetailSchema, 'PublicTrackDetail'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await fastify.prisma.sound.findFirst({
        where: { id, status: 'READY', isPublic: true },
        select: {
          id: true,
          title: true,
          artistName: true,
          description: true,
          commentary: true,
          tracklist: true,
          credits: true,
          genre: true,
          subGenres: true,
          contentType: true,
          mixVersion: true,
          bpm: true,
          musicalKey: true,
          bpmDetected: true,
          keyDetected: true,
          useDetectedBpmKey: true,
          durationSec: true,
          bannerUrl: true,
          backgroundUrl: true,
          slideshowUrls: true,
          galleryMode: true,
          license: true,
          releasedAt: true,
          peaks: true,
          mp3Key: true,
          flacKey: true,
          accessMode: true,
          purchaseTierId: true,
          _count: { select: { comments: true } },
          channel: {
            select: {
              slug: true,
              userId: true,
              user: {
                select: { username: true, displayName: true, avatarUrl: true, bio: true },
              },
            },
          },
          purchaseTier: {
            select: { id: true, name: true, priceCents: true, active: true },
          },
        },
      })

      if (!item) return reply.status(404).send({ error: 'Track not found' })

      const {
        channel,
        mp3Key,
        flacKey,
        _count,
        purchaseTier,
        accessMode,
        purchaseTierId,
        ...rest
      } = item
      const playbackKey = soundPlaybackKey({ mp3Key, flacKey })

      const viewerUserId = request.sessionUser?.id ?? null
      const gateStatus = await resolvePlaybackGateStatus(
        fastify.prisma,
        {
          artistUserId: channel.userId,
          accessMode: accessMode ?? 'FREE',
          purchaseTierId: purchaseTierId ?? null,
        },
        viewerUserId,
      )

      const [rawAudioUrl, downloadCount] = await Promise.all([
        gateStatus.allowed && playbackKey
          ? presignedGetUrl(playbackKey, 3600)
          : Promise.resolve(null),
        fastify.prisma.download.count({
          where: { soundId: item.id, countedAt: { not: null } },
        }),
      ])

      return reply.send({
        ...serializeSound(rest),
        artistName: item.artistName ?? channel.user.displayName,
        channelSlug: channel.slug,
        channel: {
          username: channel.user.username,
          displayName: channel.user.displayName,
          avatarUrl: channel.user.avatarUrl,
          bio: channel.user.bio,
        },
        releasedAt: item.releasedAt.toISOString(),
        audioUrl: rawAudioUrl,
        commentCount: _count.comments,
        downloadCount,
        accessMode: accessMode ?? 'FREE',
        purchaseTierId: purchaseTierId ?? null,
        purchaseTierName: purchaseTier?.name ?? null,
        purchaseTierPriceCents: purchaseTier?.priceCents ?? null,
        gate: gateStatus.allowed
          ? null
          : {
              reason: gateStatus.reason,
              ...(gateStatus.tierId ? { tierId: gateStatus.tierId } : {}),
            },
      })
    },
  )
}

export default trackGetRoute
