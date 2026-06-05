// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash, randomBytes } from 'node:crypto'
import { config } from '../config.js'
import { decryptSocialToken, encryptSocialToken } from './social-post.js'

const TWITTER_AUTH_URL = 'https://twitter.com/i/oauth2/authorize'
const TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'
const TWITTER_API = 'https://api.twitter.com/2'

export const TWITTER_OAUTH_SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access']

export interface TwitterTokenPair {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}

export interface TwitterUserProfile {
  id: string
  username: string
  name: string
}

function base64Url(buf: Buffer): string {
  return buf.toString('base64url')
}

export function generateTwitterPkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64Url(randomBytes(32))
  const codeChallenge = base64Url(createHash('sha256').update(codeVerifier).digest())
  return { codeVerifier, codeChallenge }
}

export function buildTwitterAuthorizeUrl(params: { state: string; codeChallenge: string }): string {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: config.twitter.clientId,
    redirect_uri: config.twitter.redirectUri,
    scope: TWITTER_OAUTH_SCOPES.join(' '),
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${TWITTER_AUTH_URL}?${q.toString()}`
}

async function twitterTokenRequest(body: URLSearchParams): Promise<TwitterTokenPair> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  if (config.twitter.clientSecret) {
    const basic = Buffer.from(`${config.twitter.clientId}:${config.twitter.clientSecret}`).toString(
      'base64',
    )
    headers.Authorization = `Basic ${basic}`
  }

  const res = await fetch(TWITTER_TOKEN_URL, { method: 'POST', headers, body })
  const data = (await res.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? `Twitter token error (${res.status})`)
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}

export async function exchangeTwitterCode(
  code: string,
  codeVerifier: string,
): Promise<TwitterTokenPair> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.twitter.redirectUri,
    code_verifier: codeVerifier,
    client_id: config.twitter.clientId,
  })
  return twitterTokenRequest(body)
}

export async function refreshTwitterAccessToken(refreshToken: string): Promise<TwitterTokenPair> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.twitter.clientId,
  })
  return twitterTokenRequest(body)
}

export async function fetchTwitterUser(accessToken: string): Promise<TwitterUserProfile> {
  const res = await fetch(`${TWITTER_API}/users/me?user.fields=username,name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = (await res.json()) as {
    data?: { id: string; username: string; name: string }
    detail?: string
    title?: string
  }
  if (!res.ok || !data.data) {
    throw new Error(data.detail ?? data.title ?? `Twitter user lookup failed (${res.status})`)
  }
  return data.data
}

export async function postToTwitter(accessToken: string, text: string): Promise<string> {
  const res = await fetch(`${TWITTER_API}/tweets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: text.slice(0, 280) }),
  })
  const data = (await res.json()) as { data?: { id: string }; detail?: string; title?: string }
  if (!res.ok || !data.data?.id) {
    throw new Error(data.detail ?? data.title ?? `Twitter post failed (${res.status})`)
  }
  return data.data.id
}

export function encodeTwitterTokens(tokens: TwitterTokenPair): string {
  return encryptSocialToken(JSON.stringify(tokens))
}

export function decodeTwitterTokens(enc: string): TwitterTokenPair {
  return JSON.parse(decryptSocialToken(enc)) as TwitterTokenPair
}

export async function twitterAccessTokenForPost(accessTokenEnc: string): Promise<string> {
  const tokens = decodeTwitterTokens(accessTokenEnc)
  if (tokens.refreshToken) {
    try {
      const refreshed = await refreshTwitterAccessToken(tokens.refreshToken)
      return refreshed.accessToken
    } catch {
      // Fall through to possibly-expired access token
    }
  }
  return tokens.accessToken
}
