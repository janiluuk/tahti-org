// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { generateVerificationToken, passwordSetupExpiresAt } from './token.js'

export async function createPasswordSetupToken(prisma: PrismaClient, userId: string) {
  const token = generateVerificationToken()
  await prisma.passwordSetup.create({
    data: {
      userId,
      token,
      expiresAt: passwordSetupExpiresAt(),
    },
  })
  return token
}

/** One query for every userId instead of one round trip each, keeping the most
 * recent active (unused, unexpired) token per user. */
export async function findActivePasswordSetupTokens(
  prisma: PrismaClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const tokens = new Map<string, string>()
  if (userIds.length === 0) return tokens

  const rows = await prisma.passwordSetup.findMany({
    where: {
      userId: { in: userIds },
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    select: { userId: true, token: true },
  })
  for (const row of rows) {
    if (!tokens.has(row.userId)) tokens.set(row.userId, row.token)
  }
  return tokens
}
