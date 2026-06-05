// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient, User, Session } from '@tahti/db'
import { generateSessionId, sessionExpiresAt } from './token.js'

export interface SessionWithUser extends Session {
  user: User
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
}

export async function deleteSession(prisma: PrismaClient, sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } })
}
