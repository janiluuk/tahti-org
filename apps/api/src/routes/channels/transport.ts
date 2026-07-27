// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChannelTransportOkResponseSchema,
  SlugParamSchema,
  archivePlaybackKey,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { presignedGetUrl } from '../../lib/minio.js'
import {
  skipChannelTrack,
  playPreviousChannelTrack,
  pauseChannelRotation,
  resumeChannelRotation,
} from '../../lib/orchestrator.js'

/** Owner/board-only transport controls for the channel page's "Manage" tab —
 * skip/previous/pause/resume act on the channel's archive rotation only; a
 * real live broadcast always takes priority regardless of pause state (see
 * infra/liquidsoap-channel.liq.template's radio_out switch). Slug-scoped like
 * manage-stats.ts, for the same reason (board members manage any channel). */
const channelTransportRoutes: FastifyPluginAsync = async (fastify) => {
  async function loadAuthorizedChannel(
    slug: string,
    username: string,
    isBoard: boolean,
  ): Promise<{ channel: { id: string } } | { error: 403 | 404 }> {
    const channel = await fastify.prisma.channel.findUnique({
      where: { slug },
      select: { id: true, user: { select: { username: true } } },
    })
    if (!channel) return { error: 404 }
    if (username !== channel.user.username && !isBoard) return { error: 403 }
    return { channel }
  }

  function registerTransportAction(
    path: 'skip' | 'pause' | 'resume',
    action: (channelId: string) => Promise<void>,
  ) {
    fastify.post(
      `/api/channels/:slug/${path}`,
      {
        preHandler: requireAuth,
        schema: {
          tags: ['channel'],
          description: `Manage tab transport control: ${path} — owner or board only`,
          response: openApiResponse(ChannelTransportOkResponseSchema, 'ChannelTransportOk'),
        },
      },
      async (request, reply) => {
        const routeParams = parseRouteParams(SlugParamSchema, request.params)
        if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
        const user = request.sessionUser!

        const result = await loadAuthorizedChannel(routeParams.slug, user.username, user.isBoard)
        if ('error' in result) {
          return reply
            .status(result.error)
            .send({ error: result.error === 404 ? 'Channel not found' : 'Not authorized' })
        }

        try {
          await action(result.channel.id)
        } catch (err) {
          const status = (err as Error & { status?: number }).status
          if (status === 404) {
            return reply.status(409).send({ error: 'Channel is not currently running' })
          }
          throw err
        }
        return reply.send({ ok: true })
      },
    )
  }

  registerTransportAction('skip', skipChannelTrack)
  registerTransportAction('pause', pauseChannelRotation)
  registerTransportAction('resume', resumeChannelRotation)

  fastify.post(
    '/api/channels/:slug/previous',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Manage tab transport control: previous — owner or board only',
        response: openApiResponse(ChannelTransportOkResponseSchema, 'ChannelTransportOk'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const user = request.sessionUser!

      const result = await loadAuthorizedChannel(routeParams.slug, user.username, user.isBoard)
      if ('error' in result) {
        return reply
          .status(result.error)
          .send({ error: result.error === 404 ? 'Channel not found' : 'Not authorized' })
      }

      // Current track = most recent RadioPlayLog row, previous = second-most-recent.
      const [, previous] = await fastify.prisma.radioPlayLog.findMany({
        where: { channelId: result.channel.id, archiveItemId: { not: null } },
        orderBy: { playedAt: 'desc' },
        take: 2,
        select: { archiveItem: { select: { mp3Key: true, flacKey: true } } },
      })
      const playbackKey = previous?.archiveItem ? archivePlaybackKey(previous.archiveItem) : null
      if (!playbackKey) {
        return reply.status(404).send({ error: 'No previous track available' })
      }
      const url = await presignedGetUrl(playbackKey, 3600)

      try {
        await playPreviousChannelTrack(result.channel.id, url)
      } catch (err) {
        const status = (err as Error & { status?: number }).status
        if (status === 404) {
          return reply.status(409).send({ error: 'Channel is not currently running' })
        }
        throw err
      }
      return reply.send({ ok: true })
    },
  )
}

export default channelTransportRoutes
