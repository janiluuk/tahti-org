// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import {
  OAuthProvidersResponseSchema,
  openApiRedirectResponse,
  openApiResponse,
} from '@tahti/shared'
import { config } from '../../config.js'
import { auditLog } from '../../lib/audit.js'
import { setAvatarFromUrl } from '../../lib/avatar-from-url.js'
import { sendVerificationEmail } from '../../lib/email.js'
import {
  createTotpChallenge,
  loginBlockedReason,
  loginDeviceLabel,
  startLoginSession,
} from '../../lib/login-session.js'
import { resolveOAuthLogin, type OAuthErrorCode } from '../../lib/oauth-login/account.js'
import {
  buildOAuthLoginAuthorizeUrl,
  configuredOAuthLoginProviders,
  fetchOAuthLoginProfile,
  isOAuthLoginConfigured,
  isOAuthLoginProvider,
} from '../../lib/oauth-login/providers.js'
import {
  OAUTH_STATE_TTL_SEC,
  clearOAuthStateCookie,
  generateOAuthState,
  generatePkce,
  parseReturnTo,
  readOAuthStateCookie,
  resolveWebOrigin,
  setOAuthStateCookie,
  stateMatches,
  webRedirectUrl,
} from '../../lib/oauth-login/state.js'

type ProviderParams = { provider: string }
type StartQuery = { returnTo?: string; link?: string }
type CallbackQuery = { code?: string; state?: string; error?: string }

function redirectError(reply: FastifyReply, webOrigin: string, code: OAuthErrorCode) {
  return reply.redirect(webRedirectUrl(webOrigin, '/', { oauth_error: code }), 302)
}

const oauthLoginRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/auth/oauth/providers',
    {
      schema: {
        tags: ['auth'],
        summary: 'Social sign-in providers',
        description: 'Providers whose OAuth client id and secret are configured on this server.',
        response: openApiResponse(OAuthProvidersResponseSchema, 'OAuthProviders'),
      },
    },
    async () => ({ providers: configuredOAuthLoginProviders() }),
  )

  fastify.get<{ Params: ProviderParams; Querystring: StartQuery }>(
    '/api/auth/oauth/:provider/start',
    {
      schema: {
        tags: ['auth'],
        summary: 'Start social sign-in',
        description:
          'Browser navigation: redirects 302 to the provider consent screen (authorization code + PKCE). `returnTo` is a same-origin relative path (default `/`). `link=1` attaches the identity to the signed-in account instead of signing in.',
        response: openApiRedirectResponse(302),
      },
    },
    async (request, reply) => {
      const { provider } = request.params
      if (!isOAuthLoginProvider(provider)) {
        return reply.status(404).send({ error: 'Unknown sign-in provider' })
      }
      const returnTo = parseReturnTo(request.query.returnTo)
      if (!returnTo) {
        return reply.status(400).send({ error: 'returnTo must be a relative path' })
      }
      const webOrigin = resolveWebOrigin(request)
      if (!isOAuthLoginConfigured(provider)) {
        return redirectError(reply, webOrigin, 'not_configured')
      }

      const wantsLink = request.query.link === '1' || request.query.link === 'true'
      const linkUser = wantsLink && request.apiTokenScopes === null ? request.sessionUser : null
      if (wantsLink && !linkUser) return redirectError(reply, webOrigin, 'failed')

      const state = generateOAuthState()
      const { codeVerifier, codeChallenge } = generatePkce()
      setOAuthStateCookie(reply, {
        provider,
        state,
        codeVerifier,
        returnTo,
        webOrigin,
        linkUserId: linkUser?.id ?? null,
        expiresAt: Date.now() + OAUTH_STATE_TTL_SEC * 1000,
      })
      return reply.redirect(buildOAuthLoginAuthorizeUrl(provider, { state, codeChallenge }), 302)
    },
  )

  fastify.get<{ Params: ProviderParams; Querystring: CallbackQuery }>(
    '/api/auth/oauth/:provider/callback',
    {
      schema: {
        tags: ['auth'],
        summary: 'Social sign-in callback',
        description:
          'The provider redirects here. Always redirects to the web app: `returnTo` with `oauth=ok` (signed in or linked), `returnTo` with `oauth=totp&challengeId=…` when the account has 2FA (finish with POST /api/auth/login/totp), or `/` with `oauth_error=cancelled|email_in_use|email_required|already_linked|not_configured|failed`.',
        response: openApiRedirectResponse(302),
      },
    },
    async (request, reply) => {
      const { provider } = request.params
      const fallbackOrigin = new URL(config.appUrl).origin
      if (!isOAuthLoginProvider(provider)) {
        return redirectError(reply, fallbackOrigin, 'not_configured')
      }

      const pending = readOAuthStateCookie(request, provider)
      clearOAuthStateCookie(reply)
      const webOrigin = pending?.webOrigin ?? fallbackOrigin
      const query = request.query

      if (!pending || !stateMatches(pending.state, query.state)) {
        return redirectError(reply, webOrigin, 'failed')
      }
      if (query.error) {
        return redirectError(
          reply,
          webOrigin,
          query.error === 'access_denied' ? 'cancelled' : 'failed',
        )
      }
      if (!isOAuthLoginConfigured(provider)) {
        return redirectError(reply, webOrigin, 'not_configured')
      }
      if (!query.code) return redirectError(reply, webOrigin, 'failed')
      if (pending.linkUserId && request.sessionUser?.id !== pending.linkUserId) {
        return redirectError(reply, webOrigin, 'failed')
      }

      let resolution: Awaited<ReturnType<typeof resolveOAuthLogin>>
      let pictureUrl: string | null = null
      try {
        const profile = await fetchOAuthLoginProfile(provider, query.code, pending.codeVerifier)
        pictureUrl = profile.pictureUrl
        resolution = await resolveOAuthLogin(fastify.prisma, provider, profile, pending.linkUserId)
      } catch (err) {
        request.log.warn({ err, provider }, 'oauth sign-in failed')
        return redirectError(reply, webOrigin, 'failed')
      }

      const success = (params: Record<string, string>) =>
        reply.redirect(webRedirectUrl(webOrigin, pending.returnTo, params), 302)

      if (resolution.kind === 'error') {
        request.log.info({ provider, reason: resolution.reason }, 'oauth sign-in refused')
        return redirectError(reply, webOrigin, resolution.code)
      }
      if (resolution.kind === 'linked') return success({ oauth: 'ok' })

      let userId: string
      if (resolution.kind === 'created') {
        const created = resolution.user
        userId = created.id
        void auditLog(fastify.prisma, {
          action: 'USER_REGISTER',
          actorId: created.id,
          meta: { username: created.username, provider },
        })
        if (created.verificationToken) {
          sendVerificationEmail(
            created.email,
            created.displayName,
            created.verificationToken,
          ).catch((err: unknown) => request.log.error({ err }, 'Failed to send verification email'))
        }
        if (pictureUrl) {
          setAvatarFromUrl(fastify.prisma, created, pictureUrl, request.log)
            .then((result) => {
              if (!result.ok) request.log.warn({ error: result.error }, 'oauth avatar skipped')
            })
            .catch((err: unknown) => request.log.warn({ err }, 'oauth avatar import failed'))
        }
      } else {
        userId = resolution.userId
      }

      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          tier: true,
          isMember: true,
          isBoard: true,
          suspendedAt: true,
          suspendReason: true,
          deletedAt: true,
          totpEnabledAt: true,
        },
      })
      if (!user) return redirectError(reply, webOrigin, 'failed')

      const blocked = await loginBlockedReason(fastify.prisma, user)
      if (blocked) {
        request.log.info({ provider, userId: user.id }, 'oauth sign-in blocked by account state')
        return redirectError(reply, webOrigin, 'failed')
      }

      if (user.totpEnabledAt) {
        const challengeId = await createTotpChallenge(fastify.prisma, user.id)
        return success({ oauth: 'totp', challengeId })
      }

      await startLoginSession(fastify.prisma, request, reply, user, {
        deviceLabel: loginDeviceLabel(request),
      })
      return success({ oauth: 'ok' })
    },
  )
}

export default oauthLoginRoutes
