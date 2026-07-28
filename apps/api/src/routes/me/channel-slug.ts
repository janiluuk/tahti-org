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
const SLUG_REDIRECT_GRACE_MS = 30 * 24 * 60 * 60 * 1000

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

      // Slugs stay reserved to the channel that just moved off them for 30
      // days — blocks a squatter grabbing an artist's old address while
      // their redirect is still live, but the artist can reclaim their own.
      const redirect = await fastify.prisma.channelSlugRedirect.findFirst({
        where: { oldSlug: slug, expiresAt: { gt: new Date() } },
        select: { channel: { select: { userId: true } } },
      })
      if (redirect && redirect.channel.userId !== user.id) {
        return reply.send({ available: false, reason: 'recently_released' })
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
        return reply.send({
          slug: channel.slug,
          rtmpStreamKey: '',
          previousSlugRedirectExpiresAt: null,
        })
      }

      const clash = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true },
      })
      if (clash) return reply.status(409).send({ error: 'That address is already taken' })

      const redirectClash = await fastify.prisma.channelSlugRedirect.findFirst({
        where: { oldSlug: slug, expiresAt: { gt: new Date() }, channelId: { not: channel.id } },
        select: { id: true },
      })
      if (redirectClash) {
        return reply
          .status(409)
          .send({ error: 'That address was recently released and is not available yet' })
      }

      const newRtmpKey = `${slug}__${nanoid(32)}`
      const newRtmpHash = await hashPassword(newRtmpKey)
      const hotPrevious =
        channel.state === 'LIVE'
          ? hotRotatePreviousFields(channel.rtmpStreamKeyHash)
          : clearHotRotatePreviousFields()

      const redirectExpiresAt = new Date(Date.now() + SLUG_REDIRECT_GRACE_MS)

      await fastify.prisma.$transaction([
        fastify.prisma.channel.update({
          where: { id: channel.id },
          data: {
            slug,
            liveSourceMount: `/live/${slug}`,
            rtmpStreamKey: newRtmpKey,
            rtmpStreamKeyHash: newRtmpHash,
            rtmpStreamKeyPreviousHash: hotPrevious.previousHash,
            rtmpStreamKeyPreviousExpiresAt: hotPrevious.previousExpiresAt,
          },
        }),
        // Reclaiming a not-yet-expired old address of this same channel — drop
        // the now-meaningless self-redirect instead of leaving slug -> itself.
        fastify.prisma.channelSlugRedirect.deleteMany({ where: { oldSlug: slug } }),
        fastify.prisma.channelSlugRedirect.create({
          data: { oldSlug: channel.slug, channelId: channel.id, expiresAt: redirectExpiresAt },
        }),
      ])

      return reply.send({
        slug,
        rtmpStreamKey: newRtmpKey,
        previousSlugRedirectExpiresAt: redirectExpiresAt.toISOString(),
      })
    },
  )
}

export default channelSlugRoutes
