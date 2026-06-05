// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  MastodonConnectSchema,
  SocialConnectionViewSchema,
  SocialManualPostSchema,
  SocialPostLogSchema,
  openApiResponse,
  openApiResponses,
  DEFAULT_SOCIAL_TEMPLATE,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import {
  encryptSocialToken,
  decryptSocialToken,
  enqueueSocialPostDispatch,
  postToMastodon,
} from '../../lib/social-post.js'

const meSocialRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/social',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(SocialConnectionViewSchema, 'SocialConnectionView'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const conn = await fastify.prisma.socialConnection.findUnique({
        where: { userId_platform: { userId: user.id, platform: 'MASTODON' } },
      })
      return reply.send({
        platform: 'MASTODON' as const,
        connected: Boolean(conn),
        instanceUrl: conn?.instanceUrl ?? null,
        onReleasePublished: conn?.onReleasePublished ?? false,
        onChannelLive: conn?.onChannelLive ?? false,
        postTemplate: conn?.postTemplate ?? DEFAULT_SOCIAL_TEMPLATE,
      })
    },
  )

  fastify.put(
    '/api/me/social/mastodon',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(SocialConnectionViewSchema, 'SocialConnectionView'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = MastodonConnectSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }
      const body = parsed.data
      const existing = await fastify.prisma.socialConnection.findUnique({
        where: { userId_platform: { userId: user.id, platform: 'MASTODON' } },
      })

      const token =
        body.accessToken ?? (existing ? decryptSocialToken(existing.accessTokenEnc) : null)
      if (!token) {
        return reply.status(400).send({ error: 'Access token is required' })
      }

      try {
        await postToMastodon({
          instanceUrl: body.instanceUrl,
          accessToken: token,
          status: existing
            ? 'Tahti social settings updated.'
            : 'Tahti social auto-post connected — test post (you can delete this).',
        })
      } catch (err) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : 'Could not verify Mastodon credentials',
        })
      }

      const conn = await fastify.prisma.socialConnection.upsert({
        where: { userId_platform: { userId: user.id, platform: 'MASTODON' } },
        create: {
          userId: user.id,
          platform: 'MASTODON',
          instanceUrl: body.instanceUrl,
          accessTokenEnc: encryptSocialToken(token),
          onReleasePublished: body.onReleasePublished ?? false,
          onChannelLive: body.onChannelLive ?? false,
          postTemplate: body.postTemplate ?? DEFAULT_SOCIAL_TEMPLATE,
        },
        update: {
          instanceUrl: body.instanceUrl,
          ...(body.accessToken ? { accessTokenEnc: encryptSocialToken(body.accessToken) } : {}),
          ...(body.onReleasePublished !== undefined
            ? { onReleasePublished: body.onReleasePublished }
            : {}),
          ...(body.onChannelLive !== undefined ? { onChannelLive: body.onChannelLive } : {}),
          ...(body.postTemplate !== undefined ? { postTemplate: body.postTemplate } : {}),
        },
      })

      return reply.send({
        platform: 'MASTODON' as const,
        connected: true,
        instanceUrl: conn.instanceUrl,
        onReleasePublished: conn.onReleasePublished,
        onChannelLive: conn.onChannelLive,
        postTemplate: conn.postTemplate,
      })
    },
  )

  fastify.delete(
    '/api/me/social/mastodon',
    {
      preHandler: requireAuth,
      schema: { tags: ['releases'] },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      await fastify.prisma.socialConnection.deleteMany({
        where: { userId: user.id, platform: 'MASTODON' },
      })
      return reply.send({ ok: true })
    },
  )

  fastify.post(
    '/api/me/social/post',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponses([
          { status: 201, schema: SocialPostLogSchema, name: 'SocialPostLog' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = SocialManualPostSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const conn = await fastify.prisma.socialConnection.findUnique({
        where: { userId_platform: { userId: user.id, platform: 'MASTODON' } },
      })
      if (!conn) {
        return reply.status(400).send({ error: 'Connect Mastodon first' })
      }

      const post = await fastify.prisma.socialPost.create({
        data: {
          userId: user.id,
          platform: 'MASTODON',
          trigger: 'manual',
          message: parsed.data.message,
        },
      })
      await enqueueSocialPostDispatch(post.id)

      return reply.status(201).send({
        id: post.id,
        trigger: post.trigger,
        state: post.state,
        message: post.message,
        externalId: post.externalId,
        error: post.error,
        createdAt: post.createdAt,
        sentAt: post.sentAt,
      })
    },
  )

  fastify.get(
    '/api/me/social/posts',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponses([
          { status: 200, schema: SocialPostLogSchema.array(), name: 'SocialPostLogList' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const rows = await fastify.prisma.socialPost.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      return reply.send(
        rows.map((p) => ({
          id: p.id,
          trigger: p.trigger,
          state: p.state,
          message: p.message,
          externalId: p.externalId,
          error: p.error,
          createdAt: p.createdAt,
          sentAt: p.sentAt,
        })),
      )
    },
  )
}

export default meSocialRoutes
