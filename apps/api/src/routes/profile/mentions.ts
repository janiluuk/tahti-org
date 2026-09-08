// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  PublicMentionListSchema,
  UsernameParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'

// M15 — public mention feed (opt-in via publicMentionsEnabled)
const publicMentionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/u/:username/mentions',
    {
      schema: {
        tags: ['mentions'],
        description: 'M15: public mentions for artists who opted in',
        response: openApiResponse(PublicMentionListSchema, 'PublicMentionList'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(UsernameParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { username } = routeParams

      const user = await fastify.prisma.user.findUnique({
        where: { username },
        select: { id: true, publicMentionsEnabled: true },
      })
      if (!user) return reply.status(404).send({ error: 'Artist not found' })
      if (!user.publicMentionsEnabled) {
        return reply.status(404).send({ error: 'Public mentions not enabled' })
      }

      const mentions = await fastify.prisma.mention.findMany({
        where: { targetUserId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          surface: true,
          sourceId: true,
          createdAt: true,
          mentioner: {
            select: {
              username: true,
              displayName: true,
              channel: { select: { slug: true } },
            },
          },
        },
      })

      // Batch-resolve TRACKLIST (Sound) and CHAT (Channel, from a composite
      // `chat:${channelId}:${ts}:${mentionerId}` sourceId) — BIO and
      // ANNOUNCEMENT resolve from `mentioner` alone, already loaded above.
      const soundIds = mentions.filter((m) => m.surface === 'TRACKLIST').map((m) => m.sourceId)
      const chatChannelIds = mentions
        .filter((m) => m.surface === 'CHAT')
        .map((m) => m.sourceId.split(':')[1])
        .filter((id): id is string => Boolean(id))

      const [sounds, chatChannels] = await Promise.all([
        soundIds.length > 0
          ? fastify.prisma.sound.findMany({
              where: { id: { in: soundIds } },
              select: { id: true, title: true },
            })
          : Promise.resolve([]),
        chatChannelIds.length > 0
          ? fastify.prisma.channel.findMany({
              where: { id: { in: chatChannelIds } },
              select: { id: true, slug: true },
            })
          : Promise.resolve([]),
      ])
      const soundById = new Map(sounds.map((s) => [s.id, s]))
      const chatChannelById = new Map(chatChannels.map((c) => [c.id, c]))

      const resolved = mentions.map((m) => {
        switch (m.surface) {
          case 'BIO':
            return {
              ...m,
              sourceTitle: m.mentioner.displayName,
              sourceUrl: `/u/${m.mentioner.username}`,
            }
          case 'TRACKLIST': {
            const sound = soundById.get(m.sourceId)
            return {
              ...m,
              sourceTitle: sound?.title ?? null,
              sourceUrl: sound ? `/t/${sound.id}` : null,
            }
          }
          case 'ANNOUNCEMENT': {
            const slug = m.mentioner.channel?.slug
            return {
              ...m,
              sourceTitle: m.mentioner.displayName,
              sourceUrl: slug ? `/channel/${slug}` : null,
            }
          }
          case 'CHAT': {
            const channelId = m.sourceId.split(':')[1]
            const channel = channelId ? chatChannelById.get(channelId) : undefined
            return {
              ...m,
              sourceTitle: m.mentioner.displayName,
              sourceUrl: channel ? `/chat/${channel.slug}` : null,
            }
          }
          default:
            return { ...m, sourceTitle: null, sourceUrl: null }
        }
      })

      return reply.send(resolved)
    },
  )
}

export default publicMentionRoutes
