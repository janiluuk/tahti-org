// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { randomBytes } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { SocialSettingsViewSchema, TwitterSocialPatchSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { getRedisClient } from '../../lib/redis.js'
import { loadSocialSettings } from '../../lib/social-post.js'
import {
  buildTwitterAuthorizeUrl,
  encodeTwitterTokens,
  exchangeTwitterCode,
  fetchTwitterUser,
  generateTwitterPkce,
  postToTwitter,
} from '../../lib/twitter-oauth.js'

const OAUTH_STATE_TTL_SEC = 600

const socialTwitterRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/social/twitter/oauth/start',
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!config.twitter.clientId) {
        return reply.status(503).send({ error: 'Twitter OAuth is not configured' })
      }

      const redis = await getRedisClient()
      if (!redis) {
        return reply.status(503).send({ error: 'OAuth temporarily unavailable' })
      }

      const user = request.sessionUser!
      const state = randomBytes(16).toString('hex')
      const { codeVerifier, codeChallenge } = generateTwitterPkce()
      await redis.setEx(
        `twitter:oauth:${state}`,
        OAUTH_STATE_TTL_SEC,
        JSON.stringify({ userId: user.id, codeVerifier }),
      )

      const url = buildTwitterAuthorizeUrl({ state, codeChallenge })
      return reply.redirect(302, url)
    },
  )

  fastify.get('/api/me/social/twitter/oauth/callback', async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string }
    if (query.error || !query.code || !query.state) {
      return reply.redirect(302, `${config.appUrl}/dashboard?social=twitter_error`)
    }

    const redis = await getRedisClient()
    if (!redis) {
      return reply.redirect(302, `${config.appUrl}/dashboard?social=twitter_error`)
    }

    const raw = await redis.get(`twitter:oauth:${query.state}`)
    await redis.del(`twitter:oauth:${query.state}`)
    if (!raw) {
      return reply.redirect(302, `${config.appUrl}/dashboard?social=twitter_error`)
    }

    const { userId, codeVerifier } = JSON.parse(raw) as {
      userId: string
      codeVerifier: string
    }

    try {
      const tokens = await exchangeTwitterCode(query.code, codeVerifier)
      const profile = await fetchTwitterUser(tokens.accessToken)
      await postToTwitter(
        tokens.accessToken,
        'Tahti social auto-post connected — test post (you can delete this).',
      )

      await fastify.prisma.socialConnection.upsert({
        where: { userId_platform: { userId, platform: 'TWITTER' } },
        create: {
          userId,
          platform: 'TWITTER',
          instanceUrl: `@${profile.username}`,
          externalAccountId: profile.id,
          accessTokenEnc: encodeTwitterTokens(tokens),
        },
        update: {
          instanceUrl: `@${profile.username}`,
          externalAccountId: profile.id,
          accessTokenEnc: encodeTwitterTokens(tokens),
        },
      })

      return reply.redirect(302, `${config.appUrl}/dashboard?social=twitter_connected`)
    } catch {
      return reply.redirect(302, `${config.appUrl}/dashboard?social=twitter_error`)
    }
  })

  fastify.patch(
    '/api/me/social/twitter',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(SocialSettingsViewSchema, 'SocialSettingsView'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = TwitterSocialPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const existing = await fastify.prisma.socialConnection.findUnique({
        where: { userId_platform: { userId: user.id, platform: 'TWITTER' } },
      })
      if (!existing) {
        return reply.status(400).send({ error: 'Connect Twitter first' })
      }

      const body = parsed.data
      await fastify.prisma.socialConnection.update({
        where: { userId_platform: { userId: user.id, platform: 'TWITTER' } },
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
    '/api/me/social/twitter',
    { preHandler: requireAuth, schema: { tags: ['releases'] } },
    async (request, reply) => {
      const user = request.sessionUser!
      await fastify.prisma.socialConnection.deleteMany({
        where: { userId: user.id, platform: 'TWITTER' },
      })
      return reply.send({ ok: true })
    },
  )
}

export default socialTwitterRoutes
