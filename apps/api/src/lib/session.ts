// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient, User, Session } from '@tahti/db'
import { generateSessionId, sessionExpiresAt } from './token.js'
import { getCachedJson, invalidateCachedJson } from './json-cache.js'

export interface SessionWithUser extends Session {
  user: User
}

// Every request carrying a session cookie hits this — not just requireAuth
// routes, see plugins/auth.ts's global preHandler. Caching collapses that
// into one DB round trip per session per window instead of one per request.
// Kept short (not the 30-60s used for public read caches elsewhere) because
// the cached value includes mutable User fields (isBoard, isMember, tier,
// suspendedAt, ...) — this is the outer bound on how long a permission
// change made elsewhere takes to apply to an already-open session. The two
// paths that need to win a race against this window instead of just waiting
// it out (logout, and SEC-010's revoke-all-sessions-on-login) invalidate
// their affected keys explicitly below rather than relying on the TTL.
const SESSION_CACHE_TTL_SEC = 15

const DATE_FIELDS = ['expiresAt', 'createdAt'] as const satisfies readonly (keyof Session)[]
const USER_DATE_FIELDS = [
  'emailVerifiedAt',
  'memberSince',
  'weeklyLiveResetAt',
  'suspendedAt',
  'deletedAt',
  'totpEnabledAt',
  'createdAt',
  'updatedAt',
] as const satisfies readonly (keyof User)[]

/** getCachedJson round-trips through JSON, which turns every Date into a
 * string — rehydrate them so callers (many, throughout the route tree) can
 * keep calling .getTime()/.toISOString() on session/user fields without
 * caring whether this came from cache or a fresh query. */
function rehydrateDates(session: SessionWithUser): SessionWithUser {
  const s = session as unknown as Record<string, unknown>
  for (const field of DATE_FIELDS) {
    if (typeof s[field] === 'string') s[field] = new Date(s[field] as string)
  }
  const u = session.user as unknown as Record<string, unknown>
  for (const field of USER_DATE_FIELDS) {
    if (typeof u[field] === 'string') u[field] = new Date(u[field] as string)
  }
  return session
}

function sessionCacheKey(sessionId: string): string {
  return `session:${sessionId}`
}

export async function createSession(prisma: PrismaClient, userId: string): Promise<Session> {
  const id = generateSessionId()
  const expiresAt = sessionExpiresAt()
  return prisma.session.create({ data: { id, userId, expiresAt } })
}

export async function validateSession(
  prisma: PrismaClient,
  sessionId: string,
): Promise<SessionWithUser | null> {
  const cached = await getCachedJson(
    sessionCacheKey(sessionId),
    SESSION_CACHE_TTL_SEC,
    async () => {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { user: true },
      })
      if (!session) return null
      if (session.expiresAt < new Date()) {
        await prisma.session.delete({ where: { id: sessionId } })
        return null
      }
      if (session.user.deletedAt) {
        await prisma.session.delete({ where: { id: sessionId } })
        return null
      }
      return session
    },
  )
  return cached ? rehydrateDates(cached) : null
}

export async function deleteSession(prisma: PrismaClient, sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } })
  await invalidateCachedJson(sessionCacheKey(sessionId))
}

/** SEC-010: called right before a fresh login session is created, so a
 * successful login (password, or the TOTP step that completes one) kicks out
 * every other active session for the account — including an attacker's, if
 * the credentials were compromised. Looks up the ids being revoked first so
 * each one's cache entry can be evicted immediately — this path exists
 * specifically to end sessions *now*, so it can't rely on the short cache
 * TTL to expire on its own. */
export async function revokeAllSessions(prisma: PrismaClient, userId: string): Promise<void> {
  const revoked = await prisma.session.findMany({ where: { userId }, select: { id: true } })
  if (revoked.length === 0) return
  await prisma.session.deleteMany({ where: { userId } })
  await Promise.all(revoked.map((s) => invalidateCachedJson(sessionCacheKey(s.id))))
}
