// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  SoundRepostResponseSchema,
  ChannelSoundParamsSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { notifyArtistOfNewRepost } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'

// Distinct from routes/engagement/sound-repost-ack.ts (SoundRepostAck — an
// acknowledgment gating a download, unrelated to sharing) — this is a real
// repost/share action, same shape as sound-likes.ts.
//
// The path segment was "archive" before the Archive->Sound rename; kept
// registered alongside the new "sounds" path so bookmarked/third-party calls
// keep working.
const REPOST_PATHS = [
  '/api/v1/c/:slug/sounds/:itemId/repost',
  '/api/v1/c/:slug/archive/:itemId/repost',
] as const

const soundRepostRoutes: FastifyPluginAsync = async (fastify) => {
  for (const url of REPOST_PATHS) {
    fastify.post(
      url,
      {
        preHandler: requireAuth,
        schema: {
          tags: ['engagement'],
          description: 'Repost/share a track',
          response: openApiResponse(SoundRepostResponseSchema, 'SoundRepost'),
        },
      },
      async (request, reply) => {
        const user = request.sessionUser!
        const routeParams = parseRouteParams(ChannelSoundParamsSchema, request.params)
        if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
        const { slug, itemId } = routeParams

        const item = await fastify.prisma.sound.findFirst({
          where: { id: itemId, channel: { slug }, status: 'READY', isPublic: true },
          select: { id: true, title: true, channel: { select: { slug: true, userId: true } } },
        })
        if (!item) return reply.status(404).send({ error: 'Sound item not found' })

        const { didCreate } = await fastify.prisma.$transaction(async (tx) => {
          const existing = await tx.soundRepost.findUnique({
            where: { userId_soundId: { userId: user.id, soundId: item.id } },
            select: { userId: true },
          })
          if (existing) return { didCreate: false }
          await tx.soundRepost.create({
            data: { userId: user.id, soundId: item.id },
          })
          return { didCreate: true }
        })

        if (didCreate) {
          await notifyArtistOfNewRepost(fastify.prisma, item.channel.userId, user, {
            id: item.id,
            title: item.title,
            channelSlug: item.channel.slug,
          }).catch((e) => fastify.log.warn(e, 'new-repost notification failed'))
        }

        const repostCount = await fastify.prisma.soundRepost.count({
          where: { soundId: item.id },
        })

        return reply.send({ reposted: true, repostCount })
      },
    )

    fastify.delete(
      url,
      {
        preHandler: requireAuth,
        schema: {
          tags: ['engagement'],
          description: 'Remove a repost',
          response: openApiResponse(SoundRepostResponseSchema, 'SoundRepost'),
        },
      },
      async (request, reply) => {
        const user = request.sessionUser!
        const routeParams = parseRouteParams(ChannelSoundParamsSchema, request.params)
        if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
        const { slug, itemId } = routeParams

        const item = await fastify.prisma.sound.findFirst({
          where: { id: itemId, channel: { slug } },
          select: { id: true },
        })
        if (!item) return reply.status(404).send({ error: 'Sound item not found' })

        await fastify.prisma.soundRepost.deleteMany({
          where: { userId: user.id, soundId: item.id },
        })

        const repostCount = await fastify.prisma.soundRepost.count({
          where: { soundId: item.id },
        })

        return reply.send({ reposted: false, repostCount })
      },
    )

    // GET is intentionally not auth-gated — the repost count is public; `reposted`
    // just reports false when there's no session instead of 401ing the whole page.
    fastify.get(
      url,
      {
        schema: {
          tags: ['engagement'],
          response: openApiResponse(SoundRepostResponseSchema, 'SoundRepost'),
        },
      },
      async (request, reply) => {
        const user = request.sessionUser
        const routeParams = parseRouteParams(ChannelSoundParamsSchema, request.params)
        if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
        const { slug, itemId } = routeParams

        const item = await fastify.prisma.sound.findFirst({
          where: { id: itemId, channel: { slug } },
          select: { id: true },
        })
        if (!item) return reply.status(404).send({ error: 'Sound item not found' })

        const [repost, repostCount] = await Promise.all([
          user
            ? fastify.prisma.soundRepost.findUnique({
                where: { userId_soundId: { userId: user.id, soundId: item.id } },
              })
            : null,
          fastify.prisma.soundRepost.count({ where: { soundId: item.id } }),
        ])

        return reply.send({ reposted: !!repost, repostCount })
      },
    )
  }
}

export default soundRepostRoutes
