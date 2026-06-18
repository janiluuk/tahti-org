// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { randomBytes } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { encryptStreamKey, decryptStreamKey } from '../../lib/stream-key-enc.js'

const OAUTH_STATE_MAX_AGE_SEC = 600
const SOUNDCLOUD_AUTHORIZE_URL = 'https://soundcloud.com/connect'
const SOUNDCLOUD_TOKEN_URL = 'https://api.soundcloud.com/oauth2/token'

const soundcloudRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/soundcloud — connection status
  fastify.get('/api/me/soundcloud', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const row = await fastify.prisma.user.findUnique({
      where: { id: user.id },
      select: { soundcloudAccessTokenEnc: true },
    })
    return reply.send({
      connected: Boolean(row?.soundcloudAccessTokenEnc),
      configured: Boolean(config.soundcloud.clientId),
    })
  })

  // GET /api/me/soundcloud/oauth/start — redirect to SoundCloud authorize
  fastify.get(
    '/api/me/soundcloud/oauth/start',
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!config.soundcloud.clientId) {
        return reply.status(503).send({ error: 'SoundCloud OAuth is not configured' })
      }

      const state = randomBytes(16).toString('hex')
      reply.setCookie(config.soundcloud.oauthStateCookie, state, {
        httpOnly: true,
        secure: config.isProd,
        sameSite: 'lax',
        maxAge: OAUTH_STATE_MAX_AGE_SEC,
        path: '/',
      })

      const url = new URL(SOUNDCLOUD_AUTHORIZE_URL)
      url.searchParams.set('client_id', config.soundcloud.clientId)
      url.searchParams.set('redirect_uri', config.soundcloud.redirectUri)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('scope', 'non-expiring')
      url.searchParams.set('state', state)
      return reply.redirect(302, url.toString())
    },
  )

  // GET /api/me/soundcloud/oauth/callback — exchange code for token
  fastify.get('/api/me/soundcloud/oauth/callback', async (request, reply) => {
    const query = request.query as Record<string, string>
    const code = query.code
    const state = query.state

    const cookieState = request.cookies[config.soundcloud.oauthStateCookie]
    if (!code || !state || state !== cookieState) {
      return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/soundcloud?sc=error`)
    }

    const sessionId = request.cookies[config.sessionCookieName]
    if (!sessionId) {
      return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/soundcloud?sc=login`)
    }

    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: { select: { id: true } } },
    })
    if (!session || session.expiresAt < new Date()) {
      return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/soundcloud?sc=login`)
    }

    try {
      const tokenRes = await fetch(SOUNDCLOUD_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.soundcloud.clientId,
          client_secret: config.soundcloud.clientSecret,
          redirect_uri: config.soundcloud.redirectUri,
          code,
        }),
      })

      if (!tokenRes.ok) throw new Error('Token exchange failed')

      const tokenData = (await tokenRes.json()) as { access_token?: string }
      if (!tokenData.access_token) throw new Error('No access token in response')

      await fastify.prisma.user.update({
        where: { id: session.user.id },
        data: { soundcloudAccessTokenEnc: encryptStreamKey(tokenData.access_token) },
      })

      reply.clearCookie(config.soundcloud.oauthStateCookie, { path: '/' })
      return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/soundcloud?sc=connected`)
    } catch {
      return reply.redirect(302, `${config.appUrl}/dashboard/upload/import/soundcloud?sc=error`)
    }
  })

  // DELETE /api/me/soundcloud — disconnect
  fastify.delete('/api/me/soundcloud', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    await fastify.prisma.user.update({
      where: { id: user.id },
      data: { soundcloudAccessTokenEnc: null },
    })
    return reply.send({ connected: false, configured: Boolean(config.soundcloud.clientId) })
  })

  // GET /api/me/soundcloud/tracks — list connected user's downloadable tracks
  fastify.get('/api/me/soundcloud/tracks', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const row = await fastify.prisma.user.findUnique({
      where: { id: user.id },
      select: { soundcloudAccessTokenEnc: true },
    })
    if (!row?.soundcloudAccessTokenEnc) {
      return reply.status(403).send({ error: 'SoundCloud account not connected' })
    }

    const token = decryptStreamKey(row.soundcloudAccessTokenEnc)

    // Fetch user's own tracks from SoundCloud API v2
    const scRes = await fetch(
      'https://api.soundcloud.com/me/tracks?limit=50&access=playable,preview,blocked&linked_partitioning=true',
      { headers: { Authorization: `OAuth ${token}`, Accept: 'application/json; charset=utf-8' } },
    )

    if (!scRes.ok) {
      if (scRes.status === 401) {
        // Token expired — clear it
        await fastify.prisma.user.update({
          where: { id: user.id },
          data: { soundcloudAccessTokenEnc: null },
        })
        return reply.status(401).send({ error: 'SoundCloud token expired — reconnect' })
      }
      return reply.status(502).send({ error: 'SoundCloud API unavailable' })
    }

    const data = (await scRes.json()) as {
      collection?: Array<{
        id: number
        title: string
        duration: number
        download_url?: string
        downloadable?: boolean
        artwork_url?: string
        created_at: string
      }>
    }

    const tracks = (data.collection ?? [])
      .filter((t) => t.downloadable && t.download_url)
      .map((t) => ({
        id: String(t.id),
        title: t.title,
        durationMs: t.duration,
        artworkUrl: t.artwork_url ?? null,
        downloadable: Boolean(t.downloadable),
        createdAt: t.created_at,
      }))

    return reply.send({ tracks })
  })
}

export default soundcloudRoutes
