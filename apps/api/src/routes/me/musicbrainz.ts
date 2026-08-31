// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { randomBytes } from 'node:crypto'
import type { FastifyPluginAsync, RouteHandlerMethod } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { encryptStreamKey } from '../../lib/stream-key-enc.js'

const OAUTH_STATE_MAX_AGE_SEC = 600
const MUSICBRAINZ_AUTHORIZE_URL = 'https://musicbrainz.org/oauth2/authorize'
const MUSICBRAINZ_TOKEN_URL = 'https://musicbrainz.org/oauth2/token'
const MUSICBRAINZ_USERINFO_URL = 'https://musicbrainz.org/oauth2/userinfo'

const musicbrainzRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/musicbrainz — connection status
  fastify.get('/api/me/musicbrainz', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const row = await fastify.prisma.user.findUnique({
      where: { id: user.id },
      select: { musicbrainzAccessTokenEnc: true, musicbrainzUsername: true },
    })
    return reply.send({
      connected: Boolean(row?.musicbrainzAccessTokenEnc),
      username: row?.musicbrainzUsername ?? null,
      configured: Boolean(config.musicbrainz.clientId),
    })
  })

  // GET /api/me/musicbrainz/oauth/start — redirect to MusicBrainz authorize
  fastify.get(
    '/api/me/musicbrainz/oauth/start',
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!config.musicbrainz.clientId) {
        return reply.status(503).send({ error: 'MusicBrainz OAuth is not configured' })
      }

      const state = randomBytes(16).toString('hex')
      reply.setCookie(config.musicbrainz.oauthStateCookie, state, {
        httpOnly: true,
        secure: config.isProd,
        sameSite: 'lax',
        maxAge: OAUTH_STATE_MAX_AGE_SEC,
        path: '/',
      })

      const url = new URL(MUSICBRAINZ_AUTHORIZE_URL)
      url.searchParams.set('client_id', config.musicbrainz.clientId)
      url.searchParams.set('redirect_uri', config.musicbrainz.redirectUri)
      url.searchParams.set('response_type', 'code')
      // "profile" identifies the connected editor (username) — creating releases
      // isn't an OAuth-gated API capability on MusicBrainz (see musicbrainz-seed.ts).
      url.searchParams.set('scope', 'profile')
      url.searchParams.set('state', state)
      return reply.redirect(302, url.toString())
    },
  )

  // GET /api/me/musicbrainz/oauth/callback — exchange code for token, fetch username
  // Keep the original path as an alias: OAuth clients created before this route
  // was corrected may still return to /api/musicbrainz/oauth/callback.
  const musicbrainzCallback: RouteHandlerMethod = async (request, reply) => {
    const query = request.query as Record<string, string>
    const code = query.code
    const state = query.state
    const dest = `${config.appUrl}/dashboard/settings/notifications`

    const cookieState = request.cookies[config.musicbrainz.oauthStateCookie]
    if (!code || !state || state !== cookieState) {
      return reply.redirect(302, `${dest}?mb=error#musicbrainz`)
    }

    const sessionId = request.cookies[config.sessionCookieName]
    if (!sessionId) {
      return reply.redirect(302, `${dest}?mb=login#musicbrainz`)
    }

    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: { select: { id: true } } },
    })
    if (!session || session.expiresAt < new Date()) {
      return reply.redirect(302, `${dest}?mb=login#musicbrainz`)
    }

    try {
      const tokenRes = await fetch(MUSICBRAINZ_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.musicbrainz.clientId,
          client_secret: config.musicbrainz.clientSecret,
          redirect_uri: config.musicbrainz.redirectUri,
          code,
        }),
      })
      if (!tokenRes.ok) throw new Error('Token exchange failed')

      const tokenData = (await tokenRes.json()) as {
        access_token?: string
        refresh_token?: string
      }
      if (!tokenData.access_token) throw new Error('No access token in response')

      let username: string | null = null
      try {
        const userinfoRes = await fetch(MUSICBRAINZ_USERINFO_URL, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        })
        if (userinfoRes.ok) {
          const info = (await userinfoRes.json()) as { sub?: string; metabrainz_user_id?: number }
          username = info.sub ?? null
        }
      } catch {
        // Connection still succeeds without a display name — shown as "Connected" only.
      }

      await fastify.prisma.user.update({
        where: { id: session.user.id },
        data: {
          musicbrainzAccessTokenEnc: encryptStreamKey(tokenData.access_token),
          ...(tokenData.refresh_token
            ? { musicbrainzRefreshTokenEnc: encryptStreamKey(tokenData.refresh_token) }
            : {}),
          musicbrainzUsername: username,
        },
      })

      reply.clearCookie(config.musicbrainz.oauthStateCookie, { path: '/' })
      return reply.redirect(302, `${dest}?mb=connected#musicbrainz`)
    } catch {
      return reply.redirect(302, `${dest}?mb=error#musicbrainz`)
    }
  }
  fastify.get('/api/me/musicbrainz/oauth/callback', musicbrainzCallback)
  fastify.get('/api/musicbrainz/oauth/callback', musicbrainzCallback)

  // DELETE /api/me/musicbrainz — disconnect
  fastify.delete('/api/me/musicbrainz', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    await fastify.prisma.user.update({
      where: { id: user.id },
      data: {
        musicbrainzAccessTokenEnc: null,
        musicbrainzRefreshTokenEnc: null,
        musicbrainzUsername: null,
      },
    })
    return reply.send({ connected: false, configured: Boolean(config.musicbrainz.clientId) })
  })

  // GET/PATCH /api/me/musicbrainz/default — remembered publish-time preference
  fastify.get(
    '/api/me/musicbrainz/default',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const row = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: { defaultRegisterToMusicbrainz: true },
      })
      return reply.send({ defaultRegisterToMusicbrainz: row?.defaultRegisterToMusicbrainz ?? null })
    },
  )

  fastify.patch(
    '/api/me/musicbrainz/default',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = request.body as { defaultRegisterToMusicbrainz?: boolean | null }
      if (
        body.defaultRegisterToMusicbrainz !== null &&
        typeof body.defaultRegisterToMusicbrainz !== 'boolean'
      ) {
        return reply
          .status(400)
          .send({ error: 'defaultRegisterToMusicbrainz must be boolean or null' })
      }
      const user = request.sessionUser!
      const updated = await fastify.prisma.user.update({
        where: { id: user.id },
        data: { defaultRegisterToMusicbrainz: body.defaultRegisterToMusicbrainz ?? null },
        select: { defaultRegisterToMusicbrainz: true },
      })
      return reply.send(updated)
    },
  )
}

export default musicbrainzRoutes
