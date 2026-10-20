// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash, randomBytes } from 'node:crypto'
import { nanoid } from 'nanoid'
import type { PrismaClient, RefreshToken, Session, User } from '@tahti/db'
import { config } from '../../config.js'
import { deleteSession } from '../../lib/session.js'

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateRefreshTokenPlaintext(): string {
  return `rfr_${randomBytes(32).toString('base64url')}`
}

function slidingExpiry(from = new Date()): Date {
  return new Date(from.getTime() + config.refreshTokenTtlSec * 1000)
}

function absoluteExpiry(familyStartedAt: Date): Date {
  return new Date(familyStartedAt.getTime() + config.refreshTokenAbsoluteCapSec * 1000)
}

export type IssuedRefresh = {
  plaintext: string
  row: RefreshToken
}

export async function createRefreshTokenFamily(
  prisma: PrismaClient,
  input: { userId: string; sessionId: string; deviceLabel?: string | null },
): Promise<IssuedRefresh> {
  const plaintext = generateRefreshTokenPlaintext()
  const row = await prisma.refreshToken.create({
    data: {
      userId: input.userId,
      sessionId: input.sessionId,
      familyId: nanoid(24),
      tokenHash: hashRefreshToken(plaintext),
      deviceLabel: input.deviceLabel ?? null,
      lastUsedAt: new Date(),
      expiresAt: slidingExpiry(),
    },
  })
  return { plaintext, row }
}

export type RefreshSuccess = {
  plaintext: string
  row: RefreshToken
  session: Session
  user: User
}

export type RefreshFailure = { kind: 'invalid' } | { kind: 'reuse' }

async function mintNextInFamily(
  prisma: PrismaClient,
  current: RefreshToken & { session: Session; user: User },
  familyStartedAt: Date,
): Promise<RefreshSuccess | RefreshFailure> {
  const nextPlaintext = generateRefreshTokenPlaintext()
  const nextExpiry = slidingExpiry()
  const cap = absoluteExpiry(familyStartedAt)
  const expiresAt = nextExpiry > cap ? cap : nextExpiry
  if (expiresAt <= new Date()) {
    await revokeRefreshFamily(prisma, current.familyId)
    await deleteSession(prisma, current.sessionId)
    return { kind: 'invalid' }
  }

  const next = await prisma.$transaction(async (tx) => {
    const created = await tx.refreshToken.create({
      data: {
        userId: current.userId,
        sessionId: current.sessionId,
        familyId: current.familyId,
        tokenHash: hashRefreshToken(nextPlaintext),
        deviceLabel: current.deviceLabel,
        lastUsedAt: new Date(),
        expiresAt,
      },
    })
    if (!current.revokedAt) {
      await tx.refreshToken.update({
        where: { id: current.id },
        data: { revokedAt: new Date(), replacedById: created.id },
      })
    }
    await tx.session.update({
      where: { id: current.sessionId },
      data: { expiresAt: new Date(Date.now() + config.sessionMaxAgeSec * 1000) },
    })
    return created
  })

  return {
    plaintext: nextPlaintext,
    row: next,
    session: current.session,
    user: current.user,
  }
}

export async function rotateRefreshToken(
  prisma: PrismaClient,
  plaintext: string,
): Promise<RefreshSuccess | RefreshFailure> {
  const tokenHash = hashRefreshToken(plaintext)
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { session: true, user: true },
  })
  if (!existing) return { kind: 'invalid' }

  if (existing.user.deletedAt || existing.user.suspendedAt) {
    await revokeRefreshFamily(prisma, existing.familyId)
    await deleteSession(prisma, existing.sessionId)
    return { kind: 'invalid' }
  }

  if (existing.expiresAt < new Date() && !existing.revokedAt) {
    return { kind: 'invalid' }
  }

  if (existing.revokedAt) {
    const graceMs = config.refreshReuseGraceSec * 1000
    const withinGrace = Date.now() - existing.revokedAt.getTime() <= graceMs
    if (withinGrace) {
      const tip = await prisma.refreshToken.findFirst({
        where: { familyId: existing.familyId, revokedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { session: true, user: true },
      })
      if (tip && tip.expiresAt >= new Date()) {
        const familyRoot = await prisma.refreshToken.findFirst({
          where: { familyId: existing.familyId },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        })
        return mintNextInFamily(prisma, tip, familyRoot?.createdAt ?? tip.createdAt)
      }
    }
    await revokeRefreshFamily(prisma, existing.familyId)
    await deleteSession(prisma, existing.sessionId)
    return { kind: 'reuse' }
  }

  const familyRoot = await prisma.refreshToken.findFirst({
    where: { familyId: existing.familyId },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  })
  return mintNextInFamily(prisma, existing, familyRoot?.createdAt ?? existing.createdAt)
}

export async function revokeRefreshFamily(prisma: PrismaClient, familyId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function revokeRefreshForSession(
  prisma: PrismaClient,
  sessionId: string,
): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function revokeAllRefreshForUser(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}
