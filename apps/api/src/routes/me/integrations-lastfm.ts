// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { upsertUserIntegrationCredential } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import {
  getLastFmAuthToken,
  getLastFmSession,
  lastFmAuthUrl,
} from '../../lib/lastfm.js'

const OAUTH_TOKEN_MAX_AGE_SEC = 600
const RETURN_COOKIE = 'tahti_lastfm_return'

function defaultReturnUrl(): string {
  return `${config.appUrl.replace(/\/$/, '')}/dashboard/settings?tab=integrations`
}

function isAllowedReturnUrl(raw: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false

  const allowedHosts = new Set<string>()
  for (const base of [
    config.appUrl,
    process.env.NUCLEAR_APP_URL,
    'https://beta.tahti.live',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
  ]) {
    if (!base) continue
    try {
      allowedHosts.add(new URL(base).host)
    } catch {
      // skip
    }
  }
  return allowedHosts.has(parsed.host)
}

function withLastFmQuery(base: string, status: string): string {
  const url = new URL(base)
  url.searchParams.set('lastfm', status)
  return url.toString()
}

const lastfmIntegrationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/integrations/lastfm/oauth/start',
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!config.lastfm.apiKey || !config.lastfm.apiSecret) {
        return reply.status(503).send({ error: 'Last.fm scrobbling is not configured' })
      }

      const query = request.query as Record<string, string>
      const returnTo = query.returnTo?.trim()
      if (returnTo && isAllowedReturnUrl(returnTo)) {
        reply.setCookie(RETURN_COOKIE, returnTo, {
          httpOnly: true,
          secure: config.isProd,
          sameSite: 'lax',
          maxAge: OAUTH_TOKEN_MAX_AGE_SEC,
          path: '/',
        })
      } else {
        reply.clearCookie(RETURN_COOKIE, { path: '/' })
      }

      const tokenResult = await getLastFmAuthToken({
        apiKey: config.lastfm.apiKey,
        apiSecret: config.lastfm.apiSecret,
      })
      if (!tokenResult.ok) {
        return reply.status(502).send({ error: tokenResult.error })
      }

      reply.setCookie(config.lastfm.oauthTokenCookie, tokenResult.token, {
        httpOnly: true,
        secure: config.isProd,
        sameSite: 'lax',
        maxAge: OAUTH_TOKEN_MAX_AGE_SEC,
        path: '/',
      })

      const authUrl = lastFmAuthUrl(
        config.lastfm.apiKey,
        tokenResult.token,
        config.lastfm.redirectUri,
      )
      return reply.redirect(302, authUrl)
    },
  )

  fastify.get('/api/me/integrations/lastfm/oauth/callback', async (request, reply) => {
    const returnCookie = request.cookies[RETURN_COOKIE]
    const returnBase =
      returnCookie && isAllowedReturnUrl(returnCookie) ? returnCookie : defaultReturnUrl()

    const query = request.query as Record<string, string>
    const tokenFromQuery = query.token?.trim()
    const tokenFromCookie = request.cookies[config.lastfm.oauthTokenCookie]
    const token = tokenFromQuery || tokenFromCookie

    reply.clearCookie(config.lastfm.oauthTokenCookie, { path: '/' })
    reply.clearCookie(RETURN_COOKIE, { path: '/' })

    if (!token) {
      return reply.redirect(302, withLastFmQuery(returnBase, 'error'))
    }
    if (!request.sessionUser) {
      return reply.redirect(302, withLastFmQuery(returnBase, 'login'))
    }
    if (!config.lastfm.apiKey || !config.lastfm.apiSecret) {
      return reply.redirect(302, withLastFmQuery(returnBase, 'unconfigured'))
    }

    const session = await getLastFmSession(
      { apiKey: config.lastfm.apiKey, apiSecret: config.lastfm.apiSecret },
      token,
    )
    if (!session.ok) {
      request.log.warn({ error: session.error }, 'Last.fm getSession failed')
      return reply.redirect(302, withLastFmQuery(returnBase, 'error'))
    }

    await upsertUserIntegrationCredential(fastify.prisma, request.sessionUser.id, 'lastfm', {
      sessionKey: session.sessionKey,
      username: session.username,
    })

    return reply.redirect(302, withLastFmQuery(returnBase, 'ok'))
  })
}

export default lastfmIntegrationRoutes
