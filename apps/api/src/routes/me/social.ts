// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  BlueskyConnectSchema,
  DEFAULT_SOCIAL_TEMPLATE,
  MastodonConnectSchema,
  SocialManualPostSchema,
  SocialPostLogSchema,
  SocialSettingsViewSchema,
  openApiResponse,
  openApiResponses,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import {
  createBlueskySession,
  decryptSocialToken,
  encryptSocialToken,
  enqueueSocialPostDispatch,
  loadSocialSettings,
  postToBluesky,
  postToMastodon,
} from '../../lib/social-post.js'

const meSocialRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/social',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(SocialSettingsViewSchema, 'SocialSettingsView'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      return reply.send(await loadSocialSettings(fastify.prisma, user.id))
    },
  )

  fastify.put(
    '/api/me/social/mastodon',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(SocialSettingsViewSchema, 'SocialSettingsView'),
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

      await fastify.prisma.socialConnection.upsert({
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

      return reply.send(await loadSocialSettings(fastify.prisma, user.id))
    },
  )

  fastify.put(
    '/api/me/social/bluesky',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(SocialSettingsViewSchema, 'SocialSettingsView'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = BlueskyConnectSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }
      const body = parsed.data
      const existing = await fastify.prisma.socialConnection.findUnique({
        where: { userId_platform: { userId: user.id, platform: 'BLUESKY' } },
      })

      let accessJwt: string
      let did: string

      if (body.appPassword) {
        try {
          const session = await createBlueskySession(body.handle, body.appPassword)
          accessJwt = session.accessJwt
          did = session.did
        } catch (err) {
          return reply.status(400).send({
            error: err instanceof Error ? err.message : 'Could not verify Bluesky credentials',
          })
        }
      } else if (existing) {
        accessJwt = decryptSocialToken(existing.accessTokenEnc)
        did = existing.externalAccountId ?? existing.instanceUrl
      } else {
        return reply.status(400).send({ error: 'App password is required' })
      }

      try {
        await postToBluesky({
          accessJwt,
          did,
          text: existing
            ? 'Tahti social settings updated.'
            : 'Tahti social auto-post connected — test post (you can delete this).',
        })
      } catch (err) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : 'Could not verify Bluesky credentials',
        })
      }

      await fastify.prisma.socialConnection.upsert({
        where: { userId_platform: { userId: user.id, platform: 'BLUESKY' } },
        create: {
          userId: user.id,
          platform: 'BLUESKY',
          instanceUrl: body.handle,
          externalAccountId: did,
          accessTokenEnc: encryptSocialToken(accessJwt),
          onReleasePublished: body.onReleasePublished ?? false,
          onChannelLive: body.onChannelLive ?? false,
          postTemplate: body.postTemplate ?? DEFAULT_SOCIAL_TEMPLATE,
        },
        update: {
          instanceUrl: body.handle,
          externalAccountId: did,
          ...(body.appPassword ? { accessTokenEnc: encryptSocialToken(accessJwt) } : {}),
          ...(body.onReleasePublished !== undefined
            ? { onReleasePublished: body.onReleasePublished }
            : {}),
          ...(body.onChannelLive !== undefined ? { onChannelLive: body.onChannelLive } : {}),
          ...(body.postTemplate !== undefined ? { postTemplate: body.postTemplate } : {}),
        },
      })

      return reply.send(await loadSocialSettings(fastify.prisma, user.id))
    },
  )

  fastify.delete(
    '/api/me/social/mastodon',
    { preHandler: requireAuth, schema: { tags: ['releases'] } },
    async (request, reply) => {
      const user = request.sessionUser!
      await fastify.prisma.socialConnection.deleteMany({
        where: { userId: user.id, platform: 'MASTODON' },
      })
      return reply.send({ ok: true })
    },
  )

  fastify.delete(
    '/api/me/social/bluesky',
    { preHandler: requireAuth, schema: { tags: ['releases'] } },
    async (request, reply) => {
      const user = request.sessionUser!
      await fastify.prisma.socialConnection.deleteMany({
        where: { userId: user.id, platform: 'BLUESKY' },
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
        where: { userId_platform: { userId: user.id, platform: parsed.data.platform } },
      })
      if (!conn) {
        return reply.status(400).send({ error: `Connect ${parsed.data.platform} first` })
      }

      const post = await fastify.prisma.socialPost.create({
        data: {
          userId: user.id,
          platform: parsed.data.platform,
          trigger: 'manual',
          message: parsed.data.message,
        },
      })
      await enqueueSocialPostDispatch(post.id)

      return reply.status(201).send({
        id: post.id,
        platform: post.platform,
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
          platform: p.platform,
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
