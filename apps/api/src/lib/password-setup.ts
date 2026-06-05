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

export async function findActivePasswordSetupToken(
  prisma: PrismaClient,
  userId: string,
): Promise<string | null> {
  const row = await prisma.passwordSetup.findFirst({
    where: {
      userId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    select: { token: true },
  })
  return row?.token ?? null
}
