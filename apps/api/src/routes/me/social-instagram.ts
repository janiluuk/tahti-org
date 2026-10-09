// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { randomBytes } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import {
  InstagramSocialPatchSchema,
  SocialOkSchema,
  SocialSettingsViewSchema,
  openApiRedirectResponse,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { getRedisClient } from '../../lib/redis.js'
import { loadSocialSettings } from '../../lib/social-post.js'
import {
  buildInstagramAuthorizeUrl,
  encodeInstagramTokens,
  exchangeInstagramCode,
  fetchInstagramAccount,
} from '../../lib/instagram-oauth.js'

const OAUTH_STATE_TTL_SEC = 600

const socialInstagramRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/social/instagram/oauth/start',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        summary: 'Start Instagram OAuth',
        description:
          'Browser navigation: redirects 302 to Instagram. Answers 503 when Instagram OAuth is not configured or Redis is down.',
        response: openApiRedirectResponse(302),
      },
    },
    async (request, reply) => {
      if (!config.instagram.clientId) {
        return reply.status(503).send({ error: 'Instagram OAuth is not configured' })
      }

      const redis = await getRedisClient()
      if (!redis) {
        return reply.status(503).send({ error: 'OAuth temporarily unavailable' })
      }

      const user = request.sessionUser!
      const state = randomBytes(16).toString('hex')
      await redis.setEx(
        `instagram:oauth:${state}`,
        OAUTH_STATE_TTL_SEC,
        JSON.stringify({ userId: user.id }),
      )

      const url = buildInstagramAuthorizeUrl({ state })
      return reply.redirect(302, url)
    },
  )

  fastify.get(
    '/api/me/social/instagram/oauth/callback',
    {
      schema: {
        tags: ['releases'],
        summary: 'Instagram OAuth callback',
        description:
          'Instagram redirects here after auth. Always redirects to the dashboard with `?social=instagram_connected` or `?social=instagram_error`.',
        response: openApiRedirectResponse(302),
      },
    },
    async (request, reply) => {
      const query = request.query as { code?: string; state?: string; error?: string }
      if (query.error || !query.code || !query.state) {
        return reply.redirect(302, `${config.appUrl}/dashboard?social=instagram_error`)
      }

      const redis = await getRedisClient()
      if (!redis) {
        return reply.redirect(302, `${config.appUrl}/dashboard?social=instagram_error`)
      }

      const raw = await redis.get(`instagram:oauth:${query.state}`)
      await redis.del(`instagram:oauth:${query.state}`)
      if (!raw) {
        return reply.redirect(302, `${config.appUrl}/dashboard?social=instagram_error`)
      }

      const { userId } = JSON.parse(raw) as { userId: string }

      try {
        const userAccessToken = await exchangeInstagramCode(query.code)
        const account = await fetchInstagramAccount(userAccessToken)

        await fastify.prisma.socialConnection.upsert({
          where: { userId_platform: { userId, platform: 'INSTAGRAM' } },
          create: {
            userId,
            platform: 'INSTAGRAM',
            instanceUrl: `@${account.username}`,
            externalAccountId: account.igUserId,
            accessTokenEnc: encodeInstagramTokens(account),
          },
          update: {
            instanceUrl: `@${account.username}`,
            externalAccountId: account.igUserId,
            accessTokenEnc: encodeInstagramTokens(account),
          },
        })

        return reply.redirect(302, `${config.appUrl}/dashboard?social=instagram_connected`)
      } catch {
        return reply.redirect(302, `${config.appUrl}/dashboard?social=instagram_error`)
      }
    },
  )

  fastify.patch(
    '/api/me/social/instagram',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        summary: 'Update Instagram auto-post settings',
        description:
          'Toggles and template for an already-connected Instagram account. JSON body is validated in the handler, not by Fastify AJV.',
        response: openApiResponse(SocialSettingsViewSchema, 'SocialSettingsView'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = InstagramSocialPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const existing = await fastify.prisma.socialConnection.findUnique({
        where: { userId_platform: { userId: user.id, platform: 'INSTAGRAM' } },
      })
      if (!existing) {
        return reply.status(400).send({ error: 'Connect Instagram first' })
      }

      const body = parsed.data
      await fastify.prisma.socialConnection.update({
        where: { userId_platform: { userId: user.id, platform: 'INSTAGRAM' } },
        data: {
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
    '/api/me/social/instagram',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        summary: 'Disconnect Instagram auto-post',
        description:
          "Removes the caller's Instagram connection. Answers 200 `{ ok: true }` (not 204).",
        response: openApiResponse(SocialOkSchema, 'SocialOk'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      await fastify.prisma.socialConnection.deleteMany({
        where: { userId: user.id, platform: 'INSTAGRAM' },
      })
      return reply.send({ ok: true })
    },
  )
}

export default socialInstagramRoutes
