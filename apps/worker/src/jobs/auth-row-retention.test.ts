// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@tahti/db'
import {
  AUTH_ROW_DELETE_BATCH,
  DEFAULT_AUTH_ROW_GRACE_DAYS,
  authRowGraceDays,
  processAuthRowRetentionJob,
  pruneRefreshTokens,
  pruneSessions,
} from './auth-row-retention.js'

const PREFIX = `authret${Date.now()}`
// Far in the past so the global sweep can only match rows this file seeds.
const NOW = new Date('2001-06-01T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000

let userId: string
let seq = 0

function days(n: number, from = NOW): Date {
  return new Date(from.getTime() + n * DAY_MS)
}

async function seedSession(expiresAt: Date): Promise<string> {
  const id = `${PREFIX}-s${seq++}`
  await prisma.session.create({ data: { id, userId, expiresAt, createdAt: days(-60) } })
  return id
}

async function seedToken(
  sessionId: string,
  familyId: string,
  data: { expiresAt: Date; revokedAt?: Date | null },
): Promise<string> {
  const row = await prisma.refreshToken.create({
    data: {
      userId,
      sessionId,
      familyId: `${PREFIX}-${familyId}`,
      tokenHash: `${PREFIX}-h${seq++}`,
      expiresAt: data.expiresAt,
      revokedAt: data.revokedAt ?? null,
      createdAt: days(-60),
    },
  })
  return row.id
}

async function sessionExists(id: string): Promise<boolean> {
  return (await prisma.session.count({ where: { id } })) === 1
}

async function tokensLeft(ids: string[]): Promise<number> {
  return prisma.refreshToken.count({ where: { id: { in: ids } } })
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}@example.com`,
      username: PREFIX,
      displayName: 'Auth Retention',
      passwordHash: 'x',
    },
  })
  userId = user.id
})

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } })
  await prisma.$disconnect()
})

describe('authRowGraceDays', () => {
  it('defaults to 7 days when unset or invalid', () => {
    expect(DEFAULT_AUTH_ROW_GRACE_DAYS).toBe(7)
    expect(authRowGraceDays({})).toBe(7)
    for (const value of ['', '0', '-3', '2.5', 'abc']) {
      expect(authRowGraceDays({ AUTH_ROW_GRACE_DAYS: value })).toBe(7)
    }
  })

  it('reads a positive whole number of days from AUTH_ROW_GRACE_DAYS', () => {
    expect(authRowGraceDays({ AUTH_ROW_GRACE_DAYS: '14' })).toBe(14)
  })

  it('deletes 5,000 rows per statement by default', () => {
    expect(AUTH_ROW_DELETE_BATCH).toBe(5000)
  })
})

describe('processAuthRowRetentionJob', () => {
  it('keeps live sessions and sessions inside the grace period', async () => {
    const live = await seedSession(days(10))
    const withinGrace = await seedSession(days(-3))
    const pastGrace = await seedSession(days(-10))

    const summary = await processAuthRowRetentionJob(prisma, { now: NOW, graceDays: 7 })

    expect(await sessionExists(live)).toBe(true)
    expect(await sessionExists(withinGrace)).toBe(true)
    expect(await sessionExists(pastGrace)).toBe(false)
    expect(summary.sessions).toBeGreaterThanOrEqual(1)
    expect(summary).toMatchObject({ graceDays: 7 })
    expect(summary.batches).toBeGreaterThanOrEqual(2)
  })

  it('keeps an expired session that an unrevoked refresh token can still extend', async () => {
    const revivable = await seedSession(days(-30))
    await seedToken(revivable, 'revivable', { expiresAt: days(20) })
    const tokenInGrace = await seedSession(days(-30))
    await seedToken(tokenInGrace, 'token-in-grace', { expiresAt: days(-3) })
    const revoked = await seedSession(days(-30))
    const revokedToken = await seedToken(revoked, 'revoked', {
      expiresAt: days(20),
      revokedAt: days(-20),
    })

    await processAuthRowRetentionJob(prisma, { now: NOW, graceDays: 7 })

    expect(await sessionExists(revivable)).toBe(true)
    expect(await sessionExists(tokenInGrace)).toBe(true)
    expect(await sessionExists(revoked)).toBe(false)
    expect(await tokensLeft([revokedToken])).toBe(0)
  })

  it('keeps every token of a family that can still mint, for reuse detection', async () => {
    const session = await seedSession(days(30))
    const rotatedLongAgo = await seedToken(session, 'live-family', {
      expiresAt: days(-5),
      revokedAt: days(-50),
    })
    const rotated = await seedToken(session, 'live-family', {
      expiresAt: days(10),
      revokedAt: days(-20),
    })
    const tip = await seedToken(session, 'live-family', { expiresAt: days(40) })

    await processAuthRowRetentionJob(prisma, { now: NOW, graceDays: 7 })

    expect(await tokensLeft([rotatedLongAgo, rotated, tip])).toBe(3)
    expect(await sessionExists(session)).toBe(true)
  })

  it('keeps a dead family until its last token has been dead for the grace period', async () => {
    const session = await seedSession(days(30))
    const revokedRecently = [
      await seedToken(session, 'revoked-recently', { expiresAt: days(-40), revokedAt: days(-50) }),
      await seedToken(session, 'revoked-recently', { expiresAt: days(30), revokedAt: days(-2) }),
    ]
    const expiredRecently = [
      await seedToken(session, 'expired-recently', { expiresAt: days(-40), revokedAt: days(-50) }),
      await seedToken(session, 'expired-recently', { expiresAt: days(-3) }),
    ]

    await processAuthRowRetentionJob(prisma, { now: NOW, graceDays: 7 })

    expect(await tokensLeft(revokedRecently)).toBe(2)
    expect(await tokensLeft(expiredRecently)).toBe(2)
  })

  it('deletes a whole family once every token has been dead past the grace period', async () => {
    const session = await seedSession(days(30))
    const family = [
      await seedToken(session, 'dead', { expiresAt: days(-40), revokedAt: days(-50) }),
      await seedToken(session, 'dead', { expiresAt: days(30), revokedAt: days(-20) }),
      await seedToken(session, 'dead', { expiresAt: days(-10) }),
    ]

    const summary = await processAuthRowRetentionJob(prisma, { now: NOW, graceDays: 7 })

    expect(await tokensLeft(family)).toBe(0)
    expect(summary.refreshTokens).toBeGreaterThanOrEqual(3)
    expect(await sessionExists(session)).toBe(true)
  })

  it('respects a longer grace period', async () => {
    const session = await seedSession(days(-10))

    await processAuthRowRetentionJob(prisma, { now: NOW, graceDays: 14 })

    expect(await sessionExists(session)).toBe(true)
  })
})

describe('batching', () => {
  const EPOCH = new Date('1990-01-01T00:00:00Z')

  it('deletes sessions in batches until a batch comes back short', async () => {
    for (let i = 0; i < 7; i++) await seedSession(days(-i, EPOCH))

    const result = await pruneSessions(prisma, days(1, EPOCH), 3)

    expect(result).toEqual({ deleted: 7, batches: 3 })
  })

  it('deletes refresh tokens in batches until a batch comes back short', async () => {
    const session = await seedSession(days(10_000, EPOCH))
    for (let i = 0; i < 6; i++) await seedToken(session, `batch-${i % 2}`, { expiresAt: EPOCH })

    const result = await pruneRefreshTokens(prisma, days(1, EPOCH), 3)

    expect(result).toEqual({ deleted: 6, batches: 3 })
  })
})
