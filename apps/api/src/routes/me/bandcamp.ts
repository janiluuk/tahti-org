// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { randomBytes } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  ImportOAuthConnectStatusSchema,
  PROVIDER_NOT_CONNECTED,
  openApiRedirectResponse,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { encryptStreamKey, decryptStreamKey } from '../../lib/stream-key-enc.js'

const BandcampAlbumsStubSchema = z.object({
  albums: z.array(z.unknown()),
  message: z.string(),
  importAvailable: z.literal(false),
})

const OAUTH_STATE_MAX_AGE_SEC = 600
const BANDCAMP_AUTHORIZE_URL = 'https://bandcamp.com/oauth_login'
const BANDCAMP_TOKEN_URL = 'https://bandcamp.com/oauth_token'

/** The token exchange needs the secret too, so a client id alone is not "configured". */
function bandcampConfigured(): boolean {
  return Boolean(config.bandcamp.clientId && config.bandcamp.clientSecret)
}

const bandcampRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/bandcamp — connection status
  fastify.get(
    '/api/me/bandcamp',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        summary: 'Bandcamp connection status',
        description:
          'Whether the caller has connected Bandcamp, and whether this server has Bandcamp OAuth configured at all.',
        response: openApiResponse(ImportOAuthConnectStatusSchema, 'ImportOAuthConnectStatus'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const row = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: { bandcampAccessTokenEnc: true },
      })
      return reply.send({
        connected: Boolean(row?.bandcampAccessTokenEnc),
        configured: bandcampConfigured(),
      })
    },
  )

  // GET /api/me/bandcamp/oauth/start — redirect to Bandcamp authorize
  fastify.get(
    '/api/me/bandcamp/oauth/start',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        summary: 'Start Bandcamp OAuth',
        description:
          'Browser navigation, not a fetch: sets a short-lived state cookie and redirects to Bandcamp. Answers 503 when Bandcamp OAuth is not configured.',
        response: openApiRedirectResponse(302),
      },
    },
    async (request, reply) => {
      if (!bandcampConfigured()) {
        return reply.status(503).send({ error: 'Bandcamp OAuth is not configured' })
      }

      const state = randomBytes(16).toString('hex')
      reply.setCookie(config.bandcamp.oauthStateCookie, state, {
        httpOnly: true,
        secure: config.isProd,
        sameSite: 'lax',
        maxAge: OAUTH_STATE_MAX_AGE_SEC,
        path: '/',
      })

      const url = new URL(BANDCAMP_AUTHORIZE_URL)
      url.searchParams.set('client_id', config.bandcamp.clientId)
      url.searchParams.set('redirect_uri', config.bandcamp.redirectUri)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('state', state)
      return reply.redirect(302, url.toString())
    },
  )

  // GET /api/me/bandcamp/oauth/callback — exchange code for token
  fastify.get(
    '/api/me/bandcamp/oauth/callback',
    {
      schema: {
        tags: ['imports'],
        summary: 'Bandcamp OAuth callback',
        description:
          'Bandcamp redirects the browser here with `code` and `state`. Always redirects to the dashboard import page with `?bc=connected`, `?bc=error` or `?bc=login`.',
        response: openApiRedirectResponse(302),
      },
    },
    async (request, reply) => {
      const query = request.query as Record<string, string>
      const code = query.code
      const state = query.state

      const cookieState = request.cookies[config.bandcamp.oauthStateCookie]
      if (!code || !state || state !== cookieState) {
        return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/bandcamp?bc=error`)
      }

      // SEC-014: use request.sessionUser (populated by the global auth
      // preHandler via lib/session.ts's validateSession) instead of
      // re-deriving it from the raw cookie — the manual version below skipped
      // validateSession's session.user.deletedAt check.
      if (!request.sessionUser) {
        return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/bandcamp?bc=login`)
      }
      const sessionUserId = request.sessionUser.id

      try {
        const tokenRes = await fetch(BANDCAMP_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: config.bandcamp.clientId,
            client_secret: config.bandcamp.clientSecret,
            redirect_uri: config.bandcamp.redirectUri,
            code,
          }),
        })

        if (!tokenRes.ok) throw new Error('Token exchange failed')

        const tokenData = (await tokenRes.json()) as { access_token?: string }
        if (!tokenData.access_token) throw new Error('No access token in response')

        await fastify.prisma.user.update({
          where: { id: sessionUserId },
          data: { bandcampAccessTokenEnc: encryptStreamKey(tokenData.access_token) },
        })

        reply.clearCookie(config.bandcamp.oauthStateCookie, { path: '/' })
        return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/bandcamp?bc=connected`)
      } catch {
        return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/bandcamp?bc=error`)
      }
    },
  )

  // DELETE /api/me/bandcamp — disconnect
  fastify.delete(
    '/api/me/bandcamp',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        summary: 'Disconnect Bandcamp',
        response: openApiResponse(ImportOAuthConnectStatusSchema, 'ImportOAuthConnectStatus'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { bandcampAccessTokenEnc: null },
      })
      return reply.send({ connected: false, configured: bandcampConfigured() })
    },
  )

  // GET /api/me/bandcamp/albums — stub until Bandcamp API v1 (catalog import:false).
  fastify.get(
    '/api/me/bandcamp/albums',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        summary: 'List Bandcamp albums (stub)',
        description:
          'Connected-account album listing. Currently returns an empty stub until Bandcamp API v1 approval; import is not available (see GET /api/me/import-plugins).',
        response: openApiResponse(BandcampAlbumsStubSchema, 'BandcampAlbumsStub'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const row = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: { bandcampAccessTokenEnc: true },
      })
      if (!row?.bandcampAccessTokenEnc) {
        return reply
          .status(403)
          .send({ error: 'Bandcamp account not connected', code: PROVIDER_NOT_CONNECTED })
      }
      // Decrypt token (kept for future Bandcamp API calls)
      void decryptStreamKey(row.bandcampAccessTokenEnc)
      return reply.send({
        albums: [],
        message:
          'Bandcamp album listing and catalog import are not available yet (API approval pending).',
        importAvailable: false as const,
      })
    },
  )
}

export default bandcampRoutes
