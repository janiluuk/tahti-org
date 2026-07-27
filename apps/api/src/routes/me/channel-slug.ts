// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import {
  ChannelSlugAvailabilityQuerySchema,
  ChannelSlugAvailabilityResponseSchema,
  ChannelSlugUpdateResponseSchema,
  ChannelSlugUpdateSchema,
  RESERVED_CHANNEL_SLUGS,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { hashPassword } from '../../lib/password.js'
import {
  hotRotatePreviousFields,
  clearHotRotatePreviousFields,
} from '../../lib/ingest-credentials.js'

const RESERVED_SET = new Set<string>(RESERVED_CHANNEL_SLUGS)

/** Self-service channel address (<slug>.tahti.live) rename. The RTMP stream key
 * embeds the slug (`<slug>__<random>`, see routes/internal/rtmp.ts's on_publish
 * lookup) — renaming issues a new one so a channel never silently loses its
 * publish credential. Icecast's on_connect derives the slug directly from the
 * mount path pattern rather than trusting the stored liveSourceMount value, so
 * that field just gets kept in sync for display — it isn't independently
 * authoritative and needs no credential rotation of its own. */
const channelSlugRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/channel/slug-available',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ChannelSlugAvailabilityResponseSchema, 'ChannelSlugAvailability'),
      },
    },
    async (request, reply) => {
      const parsed = ChannelSlugAvailabilityQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid slug' })
      }
      const { slug } = parsed.data

      if (RESERVED_SET.has(slug)) {
        return reply.send({ available: false, reason: 'reserved' })
      }

      const user = request.sessionUser!
      const existing = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { userId: true },
      })
      if (existing && existing.userId !== user.id) {
        return reply.send({ available: false, reason: 'taken' })
      }
      return reply.send({ available: true })
    },
  )

  fastify.patch(
    '/api/me/channel/slug',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ChannelSlugUpdateResponseSchema, 'ChannelSlugUpdate'),
      },
    },
    async (request, reply) => {
      const parsed = ChannelSlugUpdateSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid slug' })
      }
      const { slug } = parsed.data

      if (RESERVED_SET.has(slug)) {
        return reply.status(409).send({ error: 'That address is reserved' })
      }

      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true, slug: true, state: true, rtmpStreamKeyHash: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      if (slug === channel.slug) {
        return reply.send({ slug: channel.slug, rtmpStreamKey: '' })
      }

      const clash = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true },
      })
      if (clash) return reply.status(409).send({ error: 'That address is already taken' })

      const newRtmpKey = `${slug}__${nanoid(32)}`
      const newRtmpHash = await hashPassword(newRtmpKey)
      const hotPrevious =
        channel.state === 'LIVE'
          ? hotRotatePreviousFields(channel.rtmpStreamKeyHash)
          : clearHotRotatePreviousFields()

      await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: {
          slug,
          liveSourceMount: `/live/${slug}`,
          rtmpStreamKey: newRtmpKey,
          rtmpStreamKeyHash: newRtmpHash,
          rtmpStreamKeyPreviousHash: hotPrevious.previousHash,
          rtmpStreamKeyPreviousExpiresAt: hotPrevious.previousExpiresAt,
        },
      })

      return reply.send({ slug, rtmpStreamKey: newRtmpKey })
    },
  )
}

export default channelSlugRoutes
