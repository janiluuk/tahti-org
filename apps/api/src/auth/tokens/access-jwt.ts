// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '../../config.js'

export type AccessTokenClaims = {
  sub: string
  sid: string
  tier: string
  isMember: boolean
  isBoard: boolean
  iat: number
  exp: number
}

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlJson(value: unknown): string {
  return base64url(JSON.stringify(value))
}

function decodeBase64url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4)
  return Buffer.from(padded, 'base64')
}

export function signAccessToken(input: {
  userId: string
  sessionId: string
  tier: string
  isMember: boolean
  isBoard: boolean
}): { token: string; expiresIn: number; expiresAt: number } {
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = config.accessTokenTtlSec
  const claims: AccessTokenClaims = {
    sub: input.userId,
    sid: input.sessionId,
    tier: input.tier,
    isMember: input.isMember,
    isBoard: input.isBoard,
    iat: now,
    exp: now + expiresIn,
  }
  const header = base64urlJson({ alg: 'HS256', typ: 'JWT', kid: 'v1' })
  const body = base64urlJson(claims)
  const sig = createHmac('sha256', config.jwtAccessSecret).update(`${header}.${body}`).digest()
  return { token: `${header}.${body}.${base64url(sig)}`, expiresIn, expiresAt: claims.exp * 1000 }
}

export function verifyAccessToken(token: string): AccessTokenClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  if (!header || !body || !sig) return null
  const expected = createHmac('sha256', config.jwtAccessSecret).update(`${header}.${body}`).digest()
  let provided: Buffer
  try {
    provided = decodeBase64url(sig)
  } catch {
    return null
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null
  try {
    const claims = JSON.parse(decodeBase64url(body).toString('utf8')) as AccessTokenClaims
    if (typeof claims.sub !== 'string' || typeof claims.sid !== 'string') return null
    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) return null
    return claims
  } catch {
    return null
  }
}

export function looksLikeAccessJwt(token: string): boolean {
  if (token.startsWith('tahti_')) return false
  const parts = token.split('.')
  return parts.length === 3 && parts.every((p) => p.length > 0)
}
