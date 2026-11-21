// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import * as OTPAuth from 'otpauth'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import { config } from '../../config.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'
import { encryptTotpSecret } from '../../lib/totp-secret-enc.js'
import { generateTotpSecret } from '../../lib/totp.js'
import { OAUTH_STATE_COOKIE } from '../../lib/oauth-login/state.js'

const sendVerificationEmail = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('../../lib/email.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/email.js')>()),
  sendVerificationEmail,
}))

const PREFIX = 'oauth-login-test-'
const APP_ORIGIN = new URL(config.appUrl).origin

type Provider = 'google' | 'facebook'
type InjectResponse = Awaited<ReturnType<Awaited<ReturnType<typeof buildApp>>['inject']>>

function googleProfile(over: Record<string, unknown> = {}) {
  return {
    sub: `g-${Math.random().toString(36).slice(2)}`,
    email: `${PREFIX}${Math.random().toString(36).slice(2, 8)}@example.com`,
    email_verified: true,
    name: 'Oauthtest Ada',
    ...over,
  }
}

function facebookProfile(over: Record<string, unknown> = {}) {
  return {
    id: `fb-${Math.random().toString(36).slice(2)}`,
    email: `${PREFIX}${Math.random().toString(36).slice(2, 8)}@example.com`,
    name: 'Oauthtest Fb',
    ...over,
  }
}

function stubProviderHttp(profile: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    if (
      url.startsWith('https://oauth2.googleapis.com/token') ||
      url.includes('/oauth/access_token')
    ) {
      return Response.json({ access_token: 'provider-access-token', token_type: 'Bearer' })
    }
    if (
      url.startsWith('https://openidconnect.googleapis.com/v1/userinfo') ||
      url.startsWith('https://graph.facebook.com/v21.0/me')
    ) {
      return Response.json(profile)
    }
    return new Response('unexpected', { status: 500 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function cookieValue(res: InjectResponse, name: string): string | undefined {
  return res.cookies.find((c) => c.name === name)?.value
}

function decodeStateCookie(value: string) {
  const payload = value.slice(0, value.lastIndexOf('.'))
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    codeVerifier: string
    state: string
    returnTo: string
    linkUserId: string | null
  }
}

describe('social sign-in (Google / Facebook)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const original = { google: { ...config.googleOAuth }, facebook: { ...config.facebookOAuth } }

  function configure(provider: Provider, id = 'client-id', secret = 'client-secret') {
    const target = provider === 'google' ? config.googleOAuth : config.facebookOAuth
    target.clientId = id
    target.clientSecret = secret
  }

  async function start(
    provider: Provider,
    query = '',
    headers: Record<string, string> = {},
  ): Promise<InjectResponse> {
    return app.inject({
      method: 'GET',
      url: `/api/auth/oauth/${provider}/start${query}`,
      headers,
    })
  }

  /** Start → provider consent (mocked) → callback. */
  async function signInFlow(
    provider: Provider,
    profile: Record<string, unknown>,
    opts: { query?: string; headers?: Record<string, string>; sessionCookie?: string } = {},
  ) {
    configure(provider)
    const startHeaders = { ...(opts.headers ?? {}) }
    if (opts.sessionCookie) startHeaders.cookie = opts.sessionCookie
    const started = await start(provider, opts.query ?? '', startHeaders)
    expect(started.statusCode).toBe(302)
    const state = new URL(started.headers.location as string).searchParams.get('state')!
    const stateCookie = cookieValue(started, OAUTH_STATE_COOKIE)!
    const fetchMock = stubProviderHttp(profile)
    const cookies = [`${OAUTH_STATE_COOKIE}=${stateCookie}`]
    if (opts.sessionCookie) cookies.push(opts.sessionCookie)
    const callback = await app.inject({
      method: 'GET',
      url: `/api/auth/oauth/${provider}/callback?code=auth-code&state=${encodeURIComponent(state)}`,
      headers: { cookie: cookies.join('; ') },
    })
    return {
      started,
      callback,
      fetchMock,
      stateCookie,
      location: callback.headers.location as string,
    }
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sendVerificationEmail.mockClear()
    Object.assign(config.googleOAuth, original.google)
    Object.assign(config.facebookOAuth, original.facebook)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  describe('GET /api/auth/oauth/providers', () => {
    it('lists only providers with both a client id and a secret', async () => {
      configure('google', '', '')
      configure('facebook', '', '')
      const none = await app.inject({ method: 'GET', url: '/api/auth/oauth/providers' })
      expect(none.statusCode).toBe(200)
      expect(none.json()).toEqual({ providers: [] })

      configure('google')
      configure('facebook', 'fb-id', '')
      const googleOnly = await app.inject({ method: 'GET', url: '/api/auth/oauth/providers' })
      expect(googleOnly.json()).toEqual({ providers: ['google'] })

      configure('facebook')
      const both = await app.inject({ method: 'GET', url: '/api/auth/oauth/providers' })
      expect(both.json()).toEqual({ providers: ['google', 'facebook'] })
    })
  })

  describe('GET /api/auth/oauth/:provider/start', () => {
    it('redirects to Google with state, S256 PKCE and the API callback as redirect_uri', async () => {
      configure('google')
      const res = await start('google', '?returnTo=%2Fsettings%3Ftab%3Daccount')
      expect(res.statusCode).toBe(302)
      const url = new URL(res.headers.location as string)
      expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth')
      expect(url.searchParams.get('client_id')).toBe('client-id')
      expect(url.searchParams.get('response_type')).toBe('code')
      expect(url.searchParams.get('redirect_uri')).toBe(
        `${config.apiUrl}/api/auth/oauth/google/callback`,
      )
      expect(url.searchParams.get('scope')).toBe('openid email profile')
      expect(url.searchParams.get('code_challenge_method')).toBe('S256')
      const state = url.searchParams.get('state')
      expect(state).toBeTruthy()

      const cookie = res.cookies.find((c) => c.name === OAUTH_STATE_COOKIE)!
      expect(cookie.httpOnly).toBe(true)
      expect(cookie.path).toBe('/api/auth/oauth')
      const pending = decodeStateCookie(cookie.value)
      expect(pending.state).toBe(state)
      expect(pending.returnTo).toBe('/settings?tab=account')
      expect(url.searchParams.get('code_challenge')).toBe(
        createHash('sha256').update(pending.codeVerifier).digest('base64url'),
      )
    })

    it('redirects to the Facebook dialog with its own callback', async () => {
      configure('facebook')
      const res = await start('facebook')
      const url = new URL(res.headers.location as string)
      expect(url.hostname).toBe('www.facebook.com')
      expect(url.pathname).toMatch(/\/dialog\/oauth$/)
      expect(url.searchParams.get('redirect_uri')).toBe(
        `${config.apiUrl}/api/auth/oauth/facebook/callback`,
      )
      expect(url.searchParams.get('code_challenge_method')).toBe('S256')
      expect(url.searchParams.get('state')).toBeTruthy()
    })

    it.each([
      '//evil.example/path',
      'https://evil.example/',
      '/\\evil.example',
      'javascript:alert(1)',
      'settings',
    ])('rejects returnTo %s', async (returnTo) => {
      configure('google')
      const res = await start('google', `?returnTo=${encodeURIComponent(returnTo)}`)
      expect(res.statusCode).toBe(400)
    })

    it('redirects with not_configured when the provider has no credentials', async () => {
      configure('google', '', '')
      const res = await start('google')
      expect(res.statusCode).toBe(302)
      expect(res.headers.location).toBe(`${APP_ORIGIN}/?oauth_error=not_configured`)
    })

    it('answers 404 for an unknown provider', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/auth/oauth/myspace/start' })
      expect(res.statusCode).toBe(404)
    })

    it('refuses link=1 without a signed-in user', async () => {
      configure('google')
      const res = await start('google', '?link=1')
      expect(res.statusCode).toBe(302)
      expect(res.headers.location).toBe(`${APP_ORIGIN}/?oauth_error=failed`)
    })
  })

  describe('GET /api/auth/oauth/:provider/callback', () => {
    it('creates a new account from a verified Google profile and signs it in', async () => {
      const profile = googleProfile()
      const { callback, location, fetchMock, stateCookie } = await signInFlow('google', profile, {
        query: '?returnTo=%2Fwelcome',
      })
      expect(callback.statusCode).toBe(302)
      expect(location).toBe(`${APP_ORIGIN}/welcome?oauth=ok`)

      const tokenCall = fetchMock.mock.calls.find(([u]) =>
        String(u).startsWith('https://oauth2.googleapis.com/token'),
      )!
      const body = new URLSearchParams(String((tokenCall[1] as RequestInit).body))
      expect(body.get('code')).toBe('auth-code')
      expect(body.get('code_verifier')).toBe(decodeStateCookie(stateCookie).codeVerifier)
      expect(body.get('redirect_uri')).toBe(`${config.apiUrl}/api/auth/oauth/google/callback`)

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: profile.email },
        include: { oauthAccounts: true, channel: true, membership: true },
      })
      expect(user.username).toMatch(/^oauthtest-ada(-[a-z0-9]+)?$/)
      expect(user.displayName).toBe('Oauthtest Ada')
      expect(user.passwordHash).toBeNull()
      expect(user.emailVerifiedAt).not.toBeNull()
      expect(user.membership?.status).toBe('PENDING_PAYMENT')
      expect(user.channel?.slug).toBe(user.username)
      expect(user.oauthAccounts).toMatchObject([
        { provider: 'google', providerUserId: profile.sub, email: profile.email },
      ])
      expect(sendVerificationEmail).not.toHaveBeenCalled()

      const sessionId = cookieValue(callback, config.sessionCookieName)!
      const session = await prisma.session.findUnique({ where: { id: sessionId } })
      expect(session?.userId).toBe(user.id)
      expect(cookieValue(callback, config.refreshCookieName)).toBeTruthy()
      expect(cookieValue(callback, OAUTH_STATE_COOKIE)).toBe('')
    })

    it('appends oauth=ok to a returnTo that already has a query string, keeping the hash', async () => {
      const withQuery = await signInFlow('google', googleProfile(), {
        query: `?returnTo=${encodeURIComponent('/release/x?t=30#comments')}`,
      })
      expect(withQuery.location).toBe(`${APP_ORIGIN}/release/x?t=30&oauth=ok#comments`)

      const hashOnly = await signInFlow('google', googleProfile(), {
        query: `?returnTo=${encodeURIComponent('/release/y#top')}`,
      })
      expect(hashOnly.location).toBe(`${APP_ORIGIN}/release/y?oauth=ok#top`)
    })

    it('generates a unique username when the name is taken', async () => {
      const first = googleProfile({ name: 'Oauthtest Same' })
      const second = googleProfile({ name: 'Oauthtest Same' })
      await signInFlow('google', first)
      await signInFlow('google', second)
      const users = await prisma.user.findMany({
        where: { email: { in: [first.email, second.email] } },
        select: { username: true },
      })
      expect(new Set(users.map((u) => u.username)).size).toBe(2)
    })

    it('never uses an email address as the display name', async () => {
      const profile = facebookProfile({ name: 'oauthtest-spam@example.com' })
      const { location } = await signInFlow('facebook', profile)
      expect(location).toBe(`${APP_ORIGIN}/?oauth=ok`)
      const user = await prisma.user.findUniqueOrThrow({ where: { email: profile.email } })
      expect(user.displayName).toBe(user.username)
      expect(user.displayName).not.toContain('@')
      // Facebook does not assert email verification.
      expect(user.emailVerifiedAt).toBeNull()
      expect(sendVerificationEmail).toHaveBeenCalledTimes(1)
    })

    it('asks for an email when the provider returns none for a new account', async () => {
      const profile = facebookProfile({ email: undefined })
      const { location } = await signInFlow('facebook', profile)
      expect(location).toBe(`${APP_ORIGIN}/?oauth_error=email_required`)
      expect(
        await prisma.oAuthAccount.count({ where: { providerUserId: profile.id as string } }),
      ).toBe(0)
    })

    it('signs in the account an identity is already linked to', async () => {
      const profile = googleProfile()
      await signInFlow('google', profile)
      const user = await prisma.user.findUniqueOrThrow({ where: { email: profile.email } })

      const again = await signInFlow('google', { ...profile, email: 'changed@elsewhere.test' })
      expect(again.location).toBe(`${APP_ORIGIN}/?oauth=ok`)
      const sessionId = cookieValue(again.callback, config.sessionCookieName)!
      const session = await prisma.session.findUnique({ where: { id: sessionId } })
      expect(session?.userId).toBe(user.id)
      expect(await prisma.user.count({ where: { email: 'changed@elsewhere.test' } })).toBe(0)
    })

    it('links a verified Google email to the existing verified account and signs in', async () => {
      const existing = await createTestArtist(prisma, {
        email: `${PREFIX}existing-verified@example.com`,
        username: 'oauth-login-existing-verified',
      })
      const profile = googleProfile({ email: existing.email.toUpperCase() })
      const { location, callback } = await signInFlow('google', profile)
      expect(location).toBe(`${APP_ORIGIN}/?oauth=ok`)
      const link = await prisma.oAuthAccount.findUnique({
        where: { userId_provider: { userId: existing.id, provider: 'google' } },
      })
      expect(link?.providerUserId).toBe(profile.sub)
      const session = await prisma.session.findUnique({
        where: { id: cookieValue(callback, config.sessionCookieName)! },
      })
      expect(session?.userId).toBe(existing.id)
    })

    it.each([
      {
        name: 'Google email not verified by Google',
        provider: 'google' as const,
        profile: (email: string) => googleProfile({ email, email_verified: false }),
        verifiedLocally: true,
      },
      {
        name: 'Facebook email',
        provider: 'facebook' as const,
        profile: (email: string) => facebookProfile({ email }),
        verifiedLocally: true,
      },
      {
        name: 'Google-verified email on an unverified Tahti account',
        provider: 'google' as const,
        profile: (email: string) => googleProfile({ email }),
        verifiedLocally: false,
      },
    ])('redirects with email_in_use for $name', async ({ provider, profile, verifiedLocally }) => {
      const slug = `oauth-login-inuse-${provider}-${verifiedLocally ? 'v' : 'u'}`
      const existing = await createTestArtist(prisma, {
        email: `${PREFIX}${slug}@example.com`,
        username: slug,
        emailVerified: verifiedLocally,
      })
      const { location, callback } = await signInFlow(provider, profile(existing.email))
      expect(location).toBe(`${APP_ORIGIN}/?oauth_error=email_in_use`)
      expect(cookieValue(callback, config.sessionCookieName)).toBeUndefined()
      expect(await prisma.oAuthAccount.count({ where: { userId: existing.id } })).toBe(0)
    })

    it('attaches the identity to the signed-in user on link=1', async () => {
      const me = await createTestArtist(prisma, {
        email: `${PREFIX}linker@example.com`,
        username: 'oauth-login-linker',
      })
      const sessionCookie = await sessionCookieFor(prisma, me.id)
      const profile = facebookProfile({ email: 'someone-else@elsewhere.test' })
      const { location, callback, started } = await signInFlow('facebook', profile, {
        query: '?link=1&returnTo=%2Fsettings%2Faccount',
        sessionCookie,
      })
      expect(decodeStateCookie(cookieValue(started, OAUTH_STATE_COOKIE)!).linkUserId).toBe(me.id)
      expect(location).toBe(`${APP_ORIGIN}/settings/account?oauth=ok`)
      expect(cookieValue(callback, config.sessionCookieName)).toBeUndefined()
      const link = await prisma.oAuthAccount.findUnique({
        where: { userId_provider: { userId: me.id, provider: 'facebook' } },
      })
      expect(link?.providerUserId).toBe(profile.id)
    })

    it('redirects with already_linked when the identity belongs to another account', async () => {
      const owner = googleProfile()
      await signInFlow('google', owner)

      const other = await createTestArtist(prisma, {
        email: `${PREFIX}other-linker@example.com`,
        username: 'oauth-login-other-linker',
      })
      const sessionCookie = await sessionCookieFor(prisma, other.id)
      const { location } = await signInFlow('google', owner, { query: '?link=1', sessionCookie })
      expect(location).toBe(`${APP_ORIGIN}/?oauth_error=already_linked`)
      expect(await prisma.oAuthAccount.count({ where: { userId: other.id } })).toBe(0)
    })

    it('redirects with cancelled when the user declines consent', async () => {
      configure('google')
      const started = await start('google')
      const state = new URL(started.headers.location as string).searchParams.get('state')!
      const res = await app.inject({
        method: 'GET',
        url: `/api/auth/oauth/google/callback?error=access_denied&state=${encodeURIComponent(state)}`,
        headers: { cookie: `${OAUTH_STATE_COOKIE}=${cookieValue(started, OAUTH_STATE_COOKIE)}` },
      })
      expect(res.headers.location).toBe(`${APP_ORIGIN}/?oauth_error=cancelled`)
    })

    it('rejects a mismatched state, a missing state cookie and a tampered state cookie', async () => {
      configure('google')
      const started = await start('google')
      const state = new URL(started.headers.location as string).searchParams.get('state')!
      const stateCookie = cookieValue(started, OAUTH_STATE_COOKIE)!
      const fetchMock = stubProviderHttp(googleProfile())

      const mismatch = await app.inject({
        method: 'GET',
        url: '/api/auth/oauth/google/callback?code=c&state=not-the-state',
        headers: { cookie: `${OAUTH_STATE_COOKIE}=${stateCookie}` },
      })
      expect(mismatch.headers.location).toBe(`${APP_ORIGIN}/?oauth_error=failed`)

      const noCookie = await app.inject({
        method: 'GET',
        url: `/api/auth/oauth/google/callback?code=c&state=${encodeURIComponent(state)}`,
      })
      expect(noCookie.headers.location).toBe(`${APP_ORIGIN}/?oauth_error=failed`)

      const [payload, sig] = stateCookie.split('.')
      const forged = JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8'))
      forged.returnTo = '/elsewhere'
      const forgedPayload = Buffer.from(JSON.stringify(forged)).toString('base64url')
      const tampered = await app.inject({
        method: 'GET',
        url: `/api/auth/oauth/google/callback?code=c&state=${encodeURIComponent(state)}`,
        headers: { cookie: `${OAUTH_STATE_COOKIE}=${forgedPayload}.${sig}` },
      })
      expect(tampered.headers.location).toBe(`${APP_ORIGIN}/?oauth_error=failed`)

      const wrongProvider = await app.inject({
        method: 'GET',
        url: `/api/auth/oauth/facebook/callback?code=c&state=${encodeURIComponent(state)}`,
        headers: { cookie: `${OAUTH_STATE_COOKIE}=${stateCookie}` },
      })
      expect(wrongProvider.headers.location).toBe(`${APP_ORIGIN}/?oauth_error=failed`)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns to the web origin that started the flow, never an untrusted one', async () => {
      const trusted = await signInFlow('google', googleProfile(), {
        query: '?returnTo=%2Fx',
        headers: { referer: 'http://localhost:5173/login' },
      })
      expect(trusted.location).toBe('http://localhost:5173/x?oauth=ok')

      const untrusted = await signInFlow('google', googleProfile(), {
        query: '?returnTo=%2Fx',
        headers: { referer: 'https://evil.example/login' },
      })
      expect(untrusted.location).toBe(`${APP_ORIGIN}/x?oauth=ok`)
    })

    it('sets the same session and refresh cookies as password login', async () => {
      const passwordUser = await createTestArtist(prisma, {
        email: `${PREFIX}password-compare@example.com`,
        username: 'oauth-login-password-compare',
      })
      const passwordLogin = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: passwordUser.email, password: 'testpassword' },
      })
      expect(passwordLogin.statusCode).toBe(200)

      const { callback } = await signInFlow('google', googleProfile())

      const shape = (res: InjectResponse) =>
        res.cookies
          .filter((c) => c.name === config.sessionCookieName || c.name === config.refreshCookieName)
          .map((c) => ({
            name: c.name,
            httpOnly: c.httpOnly,
            sameSite: c.sameSite,
            path: c.path,
            maxAge: c.maxAge,
            domain: c.domain,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      expect(shape(callback)).toEqual(shape(passwordLogin))
      expect(shape(callback)).toHaveLength(2)

      const refreshed = await app.inject({
        method: 'POST',
        url: '/api/auth/token/refresh',
        headers: {
          cookie: `${config.refreshCookieName}=${cookieValue(callback, config.refreshCookieName)}`,
        },
        payload: {},
      })
      expect(refreshed.statusCode).toBe(200)
      expect(refreshed.json().accessToken).toBeTruthy()

      const me = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          cookie: `${config.sessionCookieName}=${cookieValue(callback, config.sessionCookieName)}`,
        },
      })
      expect(me.statusCode).toBe(200)
    })

    it('requires the TOTP step when the account has 2FA enabled', async () => {
      const secret = generateTotpSecret()
      const user = await createTestArtist(prisma, {
        email: `${PREFIX}totp@example.com`,
        username: 'oauth-login-totp',
      })
      await prisma.user.update({
        where: { id: user.id },
        data: { totpSecretEnc: encryptTotpSecret(secret), totpEnabledAt: new Date() },
      })
      const profile = googleProfile({ email: user.email })

      const { location, callback } = await signInFlow('google', profile, {
        query: '?returnTo=%2Fstudio',
      })
      const url = new URL(location)
      expect(`${url.origin}${url.pathname}`).toBe(`${APP_ORIGIN}/studio`)
      expect(url.searchParams.get('oauth')).toBe('totp')
      const challengeId = url.searchParams.get('challengeId')!
      expect(challengeId).toBeTruthy()
      expect(cookieValue(callback, config.sessionCookieName)).toBeUndefined()
      expect(cookieValue(callback, config.refreshCookieName)).toBeUndefined()

      const code = new OTPAuth.TOTP({
        issuer: 'Tahti',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      }).generate()
      const totp = await app.inject({
        method: 'POST',
        url: '/api/auth/login/totp',
        payload: { challengeId, code },
      })
      expect(totp.statusCode).toBe(200)
      expect(totp.json().user.id).toBe(user.id)
      expect(cookieValue(totp, config.sessionCookieName)).toBeTruthy()
    })

    it('does not sign in a suspended account', async () => {
      const profile = googleProfile()
      await signInFlow('google', profile)
      await prisma.user.update({
        where: { email: profile.email },
        data: { suspendedAt: new Date(), suspendReason: 'test' },
      })
      const { location, callback } = await signInFlow('google', profile)
      expect(location).toBe(`${APP_ORIGIN}/?oauth_error=failed`)
      expect(cookieValue(callback, config.sessionCookieName)).toBeUndefined()
    })
  })

  describe('/api/me/oauth-accounts', () => {
    it('requires a signed-in user', async () => {
      const list = await app.inject({ method: 'GET', url: '/api/me/oauth-accounts' })
      expect(list.statusCode).toBe(401)
      const del = await app.inject({ method: 'DELETE', url: '/api/me/oauth-accounts/google' })
      expect(del.statusCode).toBe(401)
    })

    it('lists linked providers and refuses to remove the last way to sign in', async () => {
      const google = googleProfile()
      const { callback } = await signInFlow('google', google)
      const user = await prisma.user.findUniqueOrThrow({ where: { email: google.email } })
      const cookie = `${config.sessionCookieName}=${cookieValue(callback, config.sessionCookieName)}`

      const list = await app.inject({
        method: 'GET',
        url: '/api/me/oauth-accounts',
        headers: { cookie },
      })
      expect(list.statusCode).toBe(200)
      const accounts = list.json().accounts as Array<Record<string, unknown>>
      expect(accounts).toHaveLength(1)
      expect(accounts[0]).toMatchObject({ provider: 'google', email: google.email })
      expect(new Date(accounts[0]!.linkedAt as string).toISOString()).toBe(accounts[0]!.linkedAt)

      const blocked = await app.inject({
        method: 'DELETE',
        url: '/api/me/oauth-accounts/google',
        headers: { cookie },
      })
      expect(blocked.statusCode).toBe(409)
      expect(blocked.json().error).toBeTruthy()

      const notLinked = await app.inject({
        method: 'DELETE',
        url: '/api/me/oauth-accounts/facebook',
        headers: { cookie },
      })
      expect(notLinked.statusCode).toBe(404)

      await signInFlow('facebook', facebookProfile(), { query: '?link=1', sessionCookie: cookie })
      const removed = await app.inject({
        method: 'DELETE',
        url: '/api/me/oauth-accounts/google',
        headers: { cookie },
      })
      expect(removed.statusCode).toBe(204)
      expect(
        (await prisma.oAuthAccount.findMany({ where: { userId: user.id } })).map((a) => a.provider),
      ).toEqual(['facebook'])

      const lastOne = await app.inject({
        method: 'DELETE',
        url: '/api/me/oauth-accounts/facebook',
        headers: { cookie },
      })
      expect(lastOne.statusCode).toBe(409)
    })

    it('lets an account with a password remove its only linked provider', async () => {
      const user = await createTestArtist(prisma, {
        email: `${PREFIX}has-password@example.com`,
        username: 'oauth-login-has-password',
      })
      const cookie = await sessionCookieFor(prisma, user.id)
      await signInFlow('google', googleProfile(), { query: '?link=1', sessionCookie: cookie })
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/me/oauth-accounts/google',
        headers: { cookie },
      })
      expect(res.statusCode).toBe(204)
      expect(await prisma.oAuthAccount.count({ where: { userId: user.id } })).toBe(0)
    })

    it('password login and password change stay safe for an account without a password', async () => {
      const google = googleProfile()
      const { callback } = await signInFlow('google', google)
      const cookie = `${config.sessionCookieName}=${cookieValue(callback, config.sessionCookieName)}`

      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: google.email, password: 'anything-at-all' },
      })
      expect(login.statusCode).toBe(401)

      const change = await app.inject({
        method: 'POST',
        url: '/api/me/password',
        headers: { cookie },
        payload: { currentPassword: 'whatever', newPassword: 'NewPassword123' },
      })
      expect(change.statusCode).toBe(400)
    })
  })
})
