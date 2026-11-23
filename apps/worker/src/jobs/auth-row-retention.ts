// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export const DEFAULT_AUTH_ROW_GRACE_DAYS = 7
export const AUTH_ROW_DELETE_BATCH = 5000

const DAY_MS = 24 * 60 * 60 * 1000

export interface AuthRowRetentionOptions {
  now?: Date
  graceDays?: number
  batchSize?: number
}

export interface AuthRowRetentionSummary {
  sessions: number
  refreshTokens: number
  batches: number
  graceDays: number
}

type Db = Pick<PrismaClient, '$executeRaw'>

export function authRowGraceDays(env: NodeJS.ProcessEnv = process.env): number {
  const days = Number(env.AUTH_ROW_GRACE_DAYS)
  return Number.isInteger(days) && days > 0 ? days : DEFAULT_AUTH_ROW_GRACE_DAYS
}

async function deleteInBatches(
  deleteBatch: () => Promise<number>,
  batchSize: number,
): Promise<{ deleted: number; batches: number }> {
  let deleted = 0
  let batches = 0
  for (;;) {
    const count = await deleteBatch()
    batches++
    deleted += count
    if (count < batchSize) break
  }
  return { deleted, batches }
}

/** Deletes refresh tokens whose whole family stopped working before `cutoff`.
 *
 * A token stops working at `revokedAt` (rotated or revoked) or `expiresAt`,
 * whichever comes first. Reuse detection (`rotateRefreshToken`) needs a
 * family's retired tokens for as long as any token in the family can still
 * mint: replaying a retired token is what revokes that live tip. So a family
 * is kept whole until every token in it has been dead for the grace period. */
export async function pruneRefreshTokens(
  prisma: Db,
  cutoff: Date,
  batchSize: number,
): Promise<{ deleted: number; batches: number }> {
  // ANY(ARRAY(...)) deletes by primary key; `IN (subquery)` plans a hash join
  // that seq-scans the table on every batch (measured in #1134).
  return deleteInBatches(
    () => prisma.$executeRaw`
      DELETE FROM "core"."RefreshToken" WHERE "id" = ANY(ARRAY(
        SELECT rt."id" FROM "core"."RefreshToken" rt
        WHERE LEAST(rt."expiresAt", COALESCE(rt."revokedAt", rt."expiresAt")) < ${cutoff}
          AND NOT EXISTS (
            SELECT 1 FROM "core"."RefreshToken" f
            WHERE f."familyId" = rt."familyId"
              AND LEAST(f."expiresAt", COALESCE(f."revokedAt", f."expiresAt")) >= ${cutoff}
          )
        LIMIT ${batchSize}
      ))`,
    batchSize,
  )
}

/** Deletes sessions that expired before `cutoff` and that no refresh token
 * can bring back. Sessions have no revoked state: logout and revocation
 * delete the row. A refresh (`mintNextInFamily`) pushes `Session.expiresAt`
 * forward without checking it, and refresh tokens outlive sessions (60 d vs
 * 30 d), so an expired session with an unrevoked token is still live. */
export async function pruneSessions(
  prisma: Db,
  cutoff: Date,
  batchSize: number,
): Promise<{ deleted: number; batches: number }> {
  return deleteInBatches(
    () => prisma.$executeRaw`
      DELETE FROM "core"."Session" WHERE "id" = ANY(ARRAY(
        SELECT s."id" FROM "core"."Session" s
        WHERE s."expiresAt" < ${cutoff}
          AND NOT EXISTS (
            SELECT 1 FROM "core"."RefreshToken" rt
            WHERE rt."sessionId" = s."id"
              AND rt."revokedAt" IS NULL
              AND rt."expiresAt" >= ${cutoff}
          )
        LIMIT ${batchSize}
      ))`,
    batchSize,
  )
}

/** Removes Session and RefreshToken rows that can no longer authenticate and
 * have been dead for longer than the grace period. */
export async function processAuthRowRetentionJob(
  prisma: Db,
  opts: AuthRowRetentionOptions = {},
): Promise<AuthRowRetentionSummary> {
  const now = opts.now ?? new Date()
  const graceDays = opts.graceDays ?? authRowGraceDays()
  const batchSize = opts.batchSize ?? AUTH_ROW_DELETE_BATCH
  const cutoff = new Date(now.getTime() - graceDays * DAY_MS)

  // Tokens first: a deleted Session cascades to its tokens, and those
  // cascaded rows would not show up in the count.
  const tokens = await pruneRefreshTokens(prisma, cutoff, batchSize)
  const sessions = await pruneSessions(prisma, cutoff, batchSize)
  const batches = tokens.batches + sessions.batches

  console.log(
    `[auth-row-retention] deleted ${sessions.deleted} Session and ${tokens.deleted} ` +
      `RefreshToken rows in ${batches} batches (dead for more than ${graceDays}d)`,
  )
  return { sessions: sessions.deleted, refreshTokens: tokens.deleted, batches, graceDays }
}
