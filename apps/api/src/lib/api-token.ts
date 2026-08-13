// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'
import { nanoid } from 'nanoid'
import type { PrismaClient, User, ApiToken } from '@tahti/db'

const TOKEN_PREFIX = 'tahti_'
/** Chars shown back to the user in lists so they can tell tokens apart without re-revealing the secret. */
const DISPLAY_PREFIX_LEN = TOKEN_PREFIX.length + 8

export interface GeneratedApiToken {
  /** Full plaintext token — only ever available at creation time, never persisted. */
  token: string
  tokenHash: string
  tokenPrefix: string
}

/** High-entropy (48 chars of nanoid's default 64-symbol alphabet, ~285 bits) — not
 * a password, so a fast hash is fine for the storage side; the entropy carries the security. */
export function generateApiToken(): GeneratedApiToken {
  const token = `${TOKEN_PREFIX}${nanoid(48)}`
  return {
    token,
    tokenHash: hashApiToken(token),
    tokenPrefix: token.slice(0, DISPLAY_PREFIX_LEN),
  }
}

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface ApiTokenAuthResult {
  user: User
  token: ApiToken
}

/** Looks up a bearer token by its hash. Expired/revoked tokens, and tokens
 * belonging to a deleted user, are treated as invalid. Touches lastUsedAt
 * best-effort (fire-and-forget — must not add latency to the request path). */
export async function validateApiToken(
  prisma: PrismaClient,
  rawToken: string,
): Promise<ApiTokenAuthResult | null> {
  if (!rawToken.startsWith(TOKEN_PREFIX)) return null

  const tokenHash = hashApiToken(rawToken)
  const token = await prisma.apiToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })
  if (!token) return null
  if (token.revokedAt) return null
  if (token.expiresAt && token.expiresAt < new Date()) return null
  if (token.user.deletedAt) return null

  void prisma.apiToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {
      // best-effort — never block or fail the request over this
    })

  return { user: token.user, token }
}
