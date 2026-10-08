// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { randomBytes } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { buildMixcloudAuthorizeUrl, exchangeMixcloudCode } from '@tahti/mixcloud'
import {
  SoundIdParamSchema,
  MixcloudConnectStatusSchema,
  MixcloudOAuthCallbackQuerySchema,
  MixcloudUploadQueuedSchema,
  MixcloudUploadStatusSchema,
  PROVIDER_NOT_CONNECTED,
  openApiRedirectResponse,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { mediaQueue } from '../../lib/queue.js'
import { encryptStreamKey } from '../../lib/stream-key-enc.js'

const OAUTH_STATE_MAX_AGE_SEC = 600

/** The token exchange needs the secret too, so a client id alone is not "configured". */
function mixcloudConfigured(): boolean {
  return Boolean(config.mixcloud.clientId && config.mixcloud.clientSecret)
}

// M7 — Mixcloud OAuth + sound mix upload
const mixcloudRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/mixcloud',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        summary: 'Mixcloud OAuth connection status',
        description:
          'Whether the caller has connected Mixcloud for archive upload, and whether this server has Mixcloud OAuth configured (client id and secret). Catalog statusPath for the Mixcloud OAuth import provider (upload/rescue, not embed search).',
        response: openApiResponse(MixcloudConnectStatusSchema, 'MixcloudConnectStatus'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const row = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: { mixcloudAccessTokenEnc: true },
      })
      return reply.send({
        connected: Boolean(row?.mixcloudAccessTokenEnc),
        configured: mixcloudConfigured(),
      })
    },
  )

  fastify.get(
    '/api/me/mixcloud/oauth/start',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        summary: 'Start Mixcloud OAuth',
        description:
          'Browser navigation, not a fetch: sets a short-lived state cookie and redirects to Mixcloud. Answers 503 when Mixcloud OAuth is not configured.',
        response: openApiRedirectResponse(302),
      },
    },
    async (request, reply) => {
      if (!mixcloudConfigured()) {
        return reply.status(503).send({ error: 'Mixcloud OAuth is not configured' })
      }

      const state = randomBytes(16).toString('hex')
      reply.setCookie(config.mixcloud.oauthStateCookie, state, {
        httpOnly: true,
        secure: config.isProd,
        sameSite: 'lax',
        maxAge: OAUTH_STATE_MAX_AGE_SEC,
        path: '/',
      })

      const url = buildMixcloudAuthorizeUrl(
        config.mixcloud.clientId,
        config.mixcloud.redirectUri,
        state,
      )
      return reply.redirect(302, url)
    },
  )

  fastify.get(
    '/api/me/mixcloud/oauth/callback',
    {
      schema: {
        tags: ['imports'],
        summary: 'Mixcloud OAuth callback',
        description:
          'Mixcloud redirects the browser here with `code` and `state`. Always redirects to the dashboard with `?mixcloud=connected`, `?mixcloud=error` or `?mixcloud=login`.',
        response: openApiRedirectResponse(302),
      },
    },
    async (request, reply) => {
      const parsedQuery = MixcloudOAuthCallbackQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return reply.redirect(302, `${config.appUrl}/dashboard?mixcloud=error`)
      }
      const code = parsedQuery.data.code
      const state = parsedQuery.data.state
      if (!code) {
        return reply.redirect(302, `${config.appUrl}/dashboard?mixcloud=error`)
      }

      const cookieState = request.cookies[config.mixcloud.oauthStateCookie]
      if (!state || !cookieState || state !== cookieState) {
        return reply.redirect(302, `${config.appUrl}/dashboard?mixcloud=error`)
      }

      // SEC-014: use the same request.sessionUser every other route relies on
      // (populated by the global auth preHandler via lib/session.ts's
      // validateSession) rather than re-deriving it from the raw cookie here —
      // the manual version below used to skip validateSession's
      // session.user.deletedAt check, so a soft-deleted account's still-live
      // session cookie could complete this OAuth link when it shouldn't.
      if (!request.sessionUser) {
        return reply.redirect(302, `${config.appUrl}/dashboard?mixcloud=login`)
      }
      const sessionUserId = request.sessionUser.id

      try {
        const { accessToken } = await exchangeMixcloudCode({
          code,
          redirectUri: config.mixcloud.redirectUri,
        })
        await fastify.prisma.user.update({
          where: { id: sessionUserId },
          data: { mixcloudAccessTokenEnc: encryptStreamKey(accessToken) },
        })
        reply.clearCookie(config.mixcloud.oauthStateCookie, { path: '/' })
        return reply.redirect(302, `${config.appUrl}/dashboard?mixcloud=connected`)
      } catch {
        return reply.redirect(302, `${config.appUrl}/dashboard?mixcloud=error`)
      }
    },
  )

  fastify.delete(
    '/api/me/mixcloud',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        summary: 'Disconnect Mixcloud',
        description:
          'Clears the stored Mixcloud token. Same `{ connected, configured }` body as status.',
        response: openApiResponse(MixcloudConnectStatusSchema, 'MixcloudConnectStatus'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { mixcloudAccessTokenEnc: null },
      })
      return reply.send({ connected: false, configured: mixcloudConfigured() })
    },
  )

  fastify.post(
    '/api/me/sound/:itemId/mixcloud',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        summary: 'Queue Mixcloud upload for a sound',
        description:
          "Upload/rescue a READY archive mix to the caller's Mixcloud account. Answers 202. 403 PROVIDER_NOT_CONNECTED when Mixcloud OAuth is configured but the caller has not connected.",
        response: openApiResponses([
          { status: 202, schema: MixcloudUploadQueuedSchema, name: 'MixcloudUploadQueued' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SoundIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { itemId } = routeParams

      const me = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: { mixcloudAccessTokenEnc: true },
      })

      if (config.mixcloud.clientId && !me?.mixcloudAccessTokenEnc) {
        return reply.status(403).send({
          error: 'Connect your Mixcloud account first',
          code: PROVIDER_NOT_CONNECTED,
          connectPath: '/api/me/mixcloud/oauth/start',
        })
      }

      const item = await fastify.prisma.sound.findFirst({
        where: { id: itemId, channel: { userId: user.id } },
        select: { id: true, status: true, mp3Key: true, rawKey: true, mixUpload: true },
      })

      if (!item) return reply.status(404).send({ error: 'Sound item not found' })
      if (item.status !== 'READY') {
        return reply.status(409).send({ error: 'Sound item is not ready for upload' })
      }
      if (item.mixUpload) {
        return reply.status(409).send({
          error: 'Already queued',
          status: item.mixUpload.status,
          mixcloudUrl: item.mixUpload.mixcloudUrl,
        })
      }

      const upload = await fastify.prisma.mixUpload.create({
        data: { userId: user.id, soundId: itemId, status: 'PENDING' },
      })

      await mediaQueue.add('mixcloud-upload', { mixUploadId: upload.id })

      return reply.status(202).send({ mixUploadId: upload.id, status: 'pending' })
    },
  )

  fastify.get(
    '/api/me/sound/:itemId/mixcloud',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        summary: 'Mixcloud upload status for a sound',
        description: 'Status of the Mixcloud upload/rescue job for this sound, if one was queued.',
        response: openApiResponse(MixcloudUploadStatusSchema, 'MixcloudUploadStatus'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SoundIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { itemId } = routeParams

      const item = await fastify.prisma.sound.findFirst({
        where: { id: itemId, channel: { userId: user.id } },
        select: { mixUpload: true },
      })

      if (!item) return reply.status(404).send({ error: 'Sound item not found' })
      if (!item.mixUpload) return reply.status(404).send({ error: 'No Mixcloud upload found' })

      return reply.send({
        status: item.mixUpload.status,
        mixcloudUrl: item.mixUpload.mixcloudUrl,
        error: item.mixUpload.error,
        completedAt: item.mixUpload.completedAt,
      })
    },
  )
}

export default mixcloudRoutes
