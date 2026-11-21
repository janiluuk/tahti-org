// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { config } from '../../config.js'
import { isAllowedOrigin } from '../allowed-origin.js'
import type { OAuthLoginProvider } from './providers.js'

export const OAUTH_STATE_COOKIE = 'tahti_oauth_login'
const OAUTH_STATE_COOKIE_PATH = '/api/auth/oauth'
export const OAUTH_STATE_TTL_SEC = 600
const MAX_RETURN_TO_LENGTH = 2048

/**
 * Pending sign-in between /start and /callback. Lives in an HMAC-signed
 * httpOnly cookie scoped to the callback path, so it works without Redis
 * and is bound to the browser that started the flow.
 */
export interface OAuthLoginState {
  provider: OAuthLoginProvider
  state: string
  codeVerifier: string
  returnTo: string
  webOrigin: string
  /** Set when the signed-in user asked to attach the identity to their account. */
  linkUserId: string | null
  expiresAt: number
}

export function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

export function generateOAuthState(): string {
  return randomBytes(24).toString('base64url')
}

/**
 * Same-origin relative path or null. Rejects protocol-relative (`//host`),
 * backslash tricks (`/\host`), schemes and control characters.
 */
export function parseReturnTo(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return '/'
  if (typeof raw !== 'string' || raw.length > MAX_RETURN_TO_LENGTH) return null
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null
  const base = 'http://return-to.invalid'
  let url: URL
  try {
    url = new URL(raw, base)
  } catch {
    return null
  }
  if (url.origin !== base) return null
  return `${url.pathname}${url.search}${url.hash}`
}

function isRedirectableOrigin(origin: string): boolean {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  if (url.hostname === 'tauri.localhost') return false
  return url.origin === origin && isAllowedOrigin(origin)
}

/**
 * The web app that sent the browser to /start (Origin, else Referer), when
 * it is one the API already trusts for CORS; otherwise APP_URL.
 */
export function resolveWebOrigin(request: FastifyRequest): string {
  const candidates = [request.headers.origin, request.headers.referer]
  for (const value of candidates) {
    if (typeof value !== 'string' || !value) continue
    let origin: string
    try {
      origin = new URL(value).origin
    } catch {
      continue
    }
    if (isRedirectableOrigin(origin)) return origin
  }
  return new URL(config.appUrl).origin
}

function sign(payload: string): string {
  return createHmac('sha256', config.sessionSecret)
    .update(`oauth-login:${payload}`)
    .digest('base64url')
}

export function setOAuthStateCookie(reply: FastifyReply, state: OAuthLoginState): void {
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url')
  reply.setCookie(OAUTH_STATE_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: OAUTH_STATE_TTL_SEC,
    path: OAUTH_STATE_COOKIE_PATH,
  })
}

export function clearOAuthStateCookie(reply: FastifyReply): void {
  reply.clearCookie(OAUTH_STATE_COOKIE, { path: OAUTH_STATE_COOKIE_PATH })
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** The signed, unexpired pending state for this provider, or null. */
export function readOAuthStateCookie(
  request: FastifyRequest,
  provider: OAuthLoginProvider,
): OAuthLoginState | null {
  const raw = request.cookies[OAUTH_STATE_COOKIE]
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = raw.slice(0, dot)
  if (!safeEqual(raw.slice(dot + 1), sign(payload))) return null
  let state: OAuthLoginState
  try {
    state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthLoginState
  } catch {
    return null
  }
  if (state.provider !== provider || state.expiresAt < Date.now()) return null
  return state
}

export function stateMatches(expected: string, actual: unknown): boolean {
  return typeof actual === 'string' && safeEqual(expected, actual)
}

/** `webOrigin + path` with params appended to its query (`?` or `&`); the client's own query and hash stay byte-for-byte. */
export function webRedirectUrl(webOrigin: string, path: string, params: Record<string, string>) {
  const hashAt = path.indexOf('#')
  const base = hashAt === -1 ? path : path.slice(0, hashAt)
  const hash = hashAt === -1 ? '' : path.slice(hashAt)
  const extra = new URLSearchParams(params).toString()
  const joiner = base.includes('?') ? (base.endsWith('?') || base.endsWith('&') ? '' : '&') : '?'
  return `${webOrigin}${base}${joiner}${extra}${hash}`
}
