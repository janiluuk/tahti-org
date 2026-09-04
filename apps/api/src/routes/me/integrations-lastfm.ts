// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { upsertUserIntegrationCredential } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { getLastFmAuthToken, getLastFmSession, lastFmAuthUrl } from '../../lib/lastfm.js'

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

function cookieOpts() {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax' as const,
    maxAge: OAUTH_TOKEN_MAX_AGE_SEC,
    path: '/',
  }
}

function clearPendingLastFmCookies(reply: FastifyReply) {
  reply.clearCookie(config.lastfm.oauthTokenCookie, { path: '/' })
  reply.clearCookie(config.lastfm.pendingApiKeyCookie, { path: '/' })
  reply.clearCookie(config.lastfm.pendingApiSecretCookie, { path: '/' })
  reply.clearCookie(RETURN_COOKIE, { path: '/' })
}

function resolveLastFmCredentials(request: FastifyRequest): {
  apiKey: string
  apiSecret: string
  fromUser: boolean
} | null {
  const pendingKey = request.cookies[config.lastfm.pendingApiKeyCookie]?.trim() ?? ''
  const pendingSecret = request.cookies[config.lastfm.pendingApiSecretCookie]?.trim() ?? ''
  if (pendingKey && pendingSecret) {
    return { apiKey: pendingKey, apiSecret: pendingSecret, fromUser: true }
  }
  if (config.lastfm.apiKey && config.lastfm.apiSecret) {
    return {
      apiKey: config.lastfm.apiKey,
      apiSecret: config.lastfm.apiSecret,
      fromUser: false,
    }
  }
  return null
}

function setReturnCookie(reply: FastifyReply, returnTo: string | undefined) {
  if (returnTo && isAllowedReturnUrl(returnTo)) {
    reply.setCookie(RETURN_COOKIE, returnTo, cookieOpts())
  } else {
    reply.clearCookie(RETURN_COOKIE, { path: '/' })
  }
}

async function beginLastFmAuth(
  reply: FastifyReply,
  credentials: { apiKey: string; apiSecret: string },
): Promise<{ ok: true; authUrl: string } | { ok: false; error: string; status: number }> {
  const tokenResult = await getLastFmAuthToken(credentials)
  if (!tokenResult.ok) {
    return { ok: false, error: tokenResult.error, status: 502 }
  }

  reply.setCookie(config.lastfm.oauthTokenCookie, tokenResult.token, cookieOpts())
  reply.setCookie(config.lastfm.pendingApiKeyCookie, credentials.apiKey, cookieOpts())
  reply.setCookie(config.lastfm.pendingApiSecretCookie, credentials.apiSecret, cookieOpts())

  return {
    ok: true,
    authUrl: lastFmAuthUrl(credentials.apiKey, tokenResult.token, config.lastfm.redirectUri),
  }
}

const lastfmIntegrationRoutes: FastifyPluginAsync = async (fastify) => {
  /** Collect the user's Last.fm API key/secret, then return the Last.fm auth URL. */
  fastify.post(
    '/api/me/integrations/lastfm/prepare',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = (request.body ?? {}) as {
        apiKey?: string
        apiSecret?: string
        returnTo?: string
      }
      const apiKey = body.apiKey?.trim() ?? ''
      const apiSecret = body.apiSecret?.trim() ?? ''
      if (!apiKey || !apiSecret) {
        return reply.status(400).send({ error: 'API key and shared secret are required' })
      }

      setReturnCookie(reply, body.returnTo?.trim())

      const started = await beginLastFmAuth(reply, { apiKey, apiSecret })
      if (!started.ok) {
        return reply.status(started.status).send({ error: started.error })
      }
      return reply.send({ authUrl: started.authUrl })
    },
  )

  fastify.get(
    '/api/me/integrations/lastfm/oauth/start',
    { preHandler: requireAuth },
    async (request, reply) => {
      const query = request.query as Record<string, string>
      setReturnCookie(reply, query.returnTo?.trim())

      const credentials = resolveLastFmCredentials(request)
      if (!credentials) {
        return reply.status(503).send({
          error:
            'Enter your Last.fm API key in Studio Integrations, or set LASTFM_API_KEY on the server',
        })
      }

      const started = await beginLastFmAuth(reply, credentials)
      if (!started.ok) {
        return reply.status(started.status).send({ error: started.error })
      }
      return reply.redirect(302, started.authUrl)
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
    const credentials = resolveLastFmCredentials(request)

    clearPendingLastFmCookies(reply)

    if (!token) {
      return reply.redirect(302, withLastFmQuery(returnBase, 'error'))
    }
    if (!request.sessionUser) {
      return reply.redirect(302, withLastFmQuery(returnBase, 'login'))
    }
    if (!credentials) {
      return reply.redirect(302, withLastFmQuery(returnBase, 'unconfigured'))
    }

    const session = await getLastFmSession(credentials, token)
    if (!session.ok) {
      request.log.warn({ error: session.error }, 'Last.fm getSession failed')
      return reply.redirect(302, withLastFmQuery(returnBase, 'error'))
    }

    const fields: Record<string, string> = {
      sessionKey: session.sessionKey,
      username: session.username,
    }
    if (credentials.fromUser) {
      fields.apiKey = credentials.apiKey
      fields.apiSecret = credentials.apiSecret
    }

    await upsertUserIntegrationCredential(fastify.prisma, request.sessionUser.id, 'lastfm', fields)

    return reply.redirect(302, withLastFmQuery(returnBase, 'ok'))
  })
}

export default lastfmIntegrationRoutes
