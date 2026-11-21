// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { config } from '../../config.js'

export const OAUTH_LOGIN_PROVIDERS = ['google', 'facebook'] as const
export type OAuthLoginProvider = (typeof OAUTH_LOGIN_PROVIDERS)[number]

export function isOAuthLoginProvider(value: string): value is OAuthLoginProvider {
  return (OAUTH_LOGIN_PROVIDERS as readonly string[]).includes(value)
}

export interface OAuthLoginProfile {
  providerUserId: string
  email: string | null
  /** True only when the provider asserts it verified the address. */
  emailVerified: boolean
  name: string | null
  pictureUrl: string | null
}

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

const FACEBOOK_GRAPH_VERSION = 'v21.0'
const FACEBOOK_AUTHORIZE_URL = `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`
const FACEBOOK_TOKEN_URL = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`
const FACEBOOK_ME_URL = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me`

const PROVIDER_FETCH_TIMEOUT_MS = 10_000

function providerConfig(provider: OAuthLoginProvider) {
  return provider === 'google' ? config.googleOAuth : config.facebookOAuth
}

export function isOAuthLoginConfigured(provider: OAuthLoginProvider): boolean {
  const c = providerConfig(provider)
  return Boolean(c.clientId && c.clientSecret)
}

export function configuredOAuthLoginProviders(): OAuthLoginProvider[] {
  return OAUTH_LOGIN_PROVIDERS.filter(isOAuthLoginConfigured)
}

export function oauthLoginRedirectUri(provider: OAuthLoginProvider): string {
  return providerConfig(provider).redirectUri
}

export function buildOAuthLoginAuthorizeUrl(
  provider: OAuthLoginProvider,
  params: { state: string; codeChallenge: string },
): string {
  const c = providerConfig(provider)
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  })
  if (provider === 'google') {
    q.set('scope', 'openid email profile')
    q.set('prompt', 'select_account')
    return `${GOOGLE_AUTHORIZE_URL}?${q.toString()}`
  }
  q.set('scope', 'email,public_profile')
  return `${FACEBOOK_AUTHORIZE_URL}?${q.toString()}`
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const data = (await res.json().catch(() => null)) as unknown
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function exchangeCode(
  provider: OAuthLoginProvider,
  code: string,
  codeVerifier: string,
): Promise<string> {
  const c = providerConfig(provider)
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: c.clientId,
    client_secret: c.clientSecret,
    redirect_uri: c.redirectUri,
    code_verifier: codeVerifier,
  })
  const res = await fetch(provider === 'google' ? GOOGLE_TOKEN_URL : FACEBOOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(PROVIDER_FETCH_TIMEOUT_MS),
  })
  const data = await readJson(res)
  const accessToken = str(data.access_token)
  if (!res.ok || !accessToken) {
    throw new Error(`${provider} token exchange failed (${res.status})`)
  }
  return accessToken
}

async function fetchGoogleProfile(accessToken: string): Promise<OAuthLoginProfile> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(PROVIDER_FETCH_TIMEOUT_MS),
  })
  const data = await readJson(res)
  const sub = str(data.sub)
  if (!res.ok || !sub) throw new Error(`google userinfo failed (${res.status})`)
  return {
    providerUserId: sub,
    email: str(data.email)?.toLowerCase() ?? null,
    emailVerified: data.email_verified === true,
    name: str(data.name),
    pictureUrl: str(data.picture),
  }
}

async function fetchFacebookProfile(accessToken: string): Promise<OAuthLoginProfile> {
  const q = new URLSearchParams({ fields: 'id,name,email,picture.type(large)' })
  const res = await fetch(`${FACEBOOK_ME_URL}?${q.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(PROVIDER_FETCH_TIMEOUT_MS),
  })
  const data = await readJson(res)
  const id = str(data.id)
  if (!res.ok || !id) throw new Error(`facebook /me failed (${res.status})`)
  const picture = (
    data.picture as { data?: { url?: unknown; is_silhouette?: unknown } } | undefined
  )?.data
  return {
    providerUserId: id,
    email: str(data.email)?.toLowerCase() ?? null,
    // Graph API does not assert verification, so a Facebook email never links or verifies.
    emailVerified: false,
    name: str(data.name),
    pictureUrl: picture && picture.is_silhouette !== true ? str(picture.url) : null,
  }
}

export async function fetchOAuthLoginProfile(
  provider: OAuthLoginProvider,
  code: string,
  codeVerifier: string,
): Promise<OAuthLoginProfile> {
  const accessToken = await exchangeCode(provider, code, codeVerifier)
  return provider === 'google' ? fetchGoogleProfile(accessToken) : fetchFacebookProfile(accessToken)
}
