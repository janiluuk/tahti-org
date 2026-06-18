// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { randomBytes } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { encryptStreamKey, decryptStreamKey } from '../../lib/stream-key-enc.js'

const OAUTH_STATE_MAX_AGE_SEC = 600
const BANDCAMP_AUTHORIZE_URL = 'https://bandcamp.com/oauth_login'
const BANDCAMP_TOKEN_URL = 'https://bandcamp.com/oauth_token'

const bandcampRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/bandcamp — connection status
  fastify.get('/api/me/bandcamp', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const row = await fastify.prisma.user.findUnique({
      where: { id: user.id },
      select: { bandcampAccessTokenEnc: true },
    })
    return reply.send({
      connected: Boolean(row?.bandcampAccessTokenEnc),
      configured: Boolean(config.bandcamp.clientId),
    })
  })

  // GET /api/me/bandcamp/oauth/start — redirect to Bandcamp authorize
  fastify.get(
    '/api/me/bandcamp/oauth/start',
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!config.bandcamp.clientId) {
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
  fastify.get('/api/me/bandcamp/oauth/callback', async (request, reply) => {
    const query = request.query as Record<string, string>
    const code = query.code
    const state = query.state

    const cookieState = request.cookies[config.bandcamp.oauthStateCookie]
    if (!code || !state || state !== cookieState) {
      return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/bandcamp?bc=error`)
    }

    const sessionId = request.cookies[config.sessionCookieName]
    if (!sessionId) {
      return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/bandcamp?bc=login`)
    }

    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: { select: { id: true } } },
    })
    if (!session || session.expiresAt < new Date()) {
      return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/bandcamp?bc=login`)
    }

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
        where: { id: session.user.id },
        data: { bandcampAccessTokenEnc: encryptStreamKey(tokenData.access_token) },
      })

      reply.clearCookie(config.bandcamp.oauthStateCookie, { path: '/' })
      return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/bandcamp?bc=connected`)
    } catch {
      return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/bandcamp?bc=error`)
    }
  })

  // DELETE /api/me/bandcamp — disconnect
  fastify.delete('/api/me/bandcamp', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { bandcampAccessTokenEnc: null },
    })
    return reply.send({ connected: false, configured: Boolean(config.bandcamp.clientId) })
  })

  // GET /api/me/bandcamp/albums — list connected artist's albums (stub until Bandcamp API v1)
  fastify.get('/api/me/bandcamp/albums', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const row = await fastify.prisma.user.findUnique({
      where: { id: user.id },
      select: { bandcampAccessTokenEnc: true },
    })
    if (!row?.bandcampAccessTokenEnc) {
      return reply.status(403).send({ error: 'Bandcamp account not connected' })
    }
    // Decrypt token (kept for future Bandcamp API calls)
    void decryptStreamKey(row.bandcampAccessTokenEnc)
    // Bandcamp's artist sales/album APIs require a separate approval process.
    // Return empty for now — the web UI will show a "coming soon" state.
    return reply.send({ albums: [], message: 'Album listing coming soon' })
  })
}

export default bandcampRoutes
