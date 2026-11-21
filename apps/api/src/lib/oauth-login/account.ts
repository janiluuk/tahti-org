// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { Prisma } from '@tahti/db'
import { nanoid } from 'nanoid'
import { RESERVED_CHANNEL_SLUGS, safeDisplayName } from '@tahti/shared'
import { createArtistAccount, suggestUsernameFromName } from '../create-artist-account.js'
import { generateVerificationToken, verificationExpiresAt } from '../token.js'
import type { OAuthLoginProfile, OAuthLoginProvider } from './providers.js'

const RESERVED = new Set<string>(RESERVED_CHANNEL_SLUGS)
const USERNAME_MAX = 32
const DISPLAY_NAME_MAX = 64

export type OAuthErrorCode =
  'cancelled' | 'email_in_use' | 'already_linked' | 'not_configured' | 'failed'

async function usernameTaken(prisma: PrismaClient, candidate: string): Promise<boolean> {
  if (RESERVED.has(candidate)) return true
  const [user, channel] = await Promise.all([
    prisma.user.findUnique({ where: { username: candidate }, select: { id: true } }),
    prisma.channel.findUnique({ where: { slug: candidate }, select: { id: true } }),
  ])
  return Boolean(user || channel)
}

/** Lowercase handle from the provider name or email local part, made unique. */
export async function generateUniqueUsername(
  prisma: PrismaClient,
  seeds: Array<string | null>,
): Promise<string> {
  const seed = seeds.find((s): s is string => Boolean(s?.trim())) ?? 'artist'
  const base = suggestUsernameFromName(seed)
  if (!(await usernameTaken(prisma, base))) return base
  for (let n = 2; n <= 20; n++) {
    const suffix = `-${n}`
    const candidate = `${base.slice(0, USERNAME_MAX - suffix.length)}${suffix}`
    if (!(await usernameTaken(prisma, candidate))) return candidate
  }
  for (;;) {
    const suffix = `-${nanoid(6)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '0')}`
    const candidate = `${base.slice(0, USERNAME_MAX - suffix.length)}${suffix}`
    if (!(await usernameTaken(prisma, candidate))) return candidate
  }
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

async function linkIdentity(
  prisma: PrismaClient,
  userId: string,
  provider: OAuthLoginProvider,
  profile: OAuthLoginProfile,
): Promise<boolean> {
  try {
    await prisma.oAuthAccount.create({
      data: { userId, provider, providerUserId: profile.providerUserId, email: profile.email },
    })
    return true
  } catch (err) {
    if (isUniqueViolation(err)) return false
    throw err
  }
}

export interface NewOAuthUser {
  id: string
  email: string
  username: string
  displayName: string
  verificationToken: string | null
}

export type OAuthResolution =
  | { kind: 'sign_in'; userId: string }
  | { kind: 'created'; user: NewOAuthUser }
  | { kind: 'linked' }
  | { kind: 'error'; code: OAuthErrorCode; reason: string }

async function createOAuthUser(
  prisma: PrismaClient,
  provider: OAuthLoginProvider,
  profile: OAuthLoginProfile & { email: string },
): Promise<NewOAuthUser> {
  const username = await generateUniqueUsername(prisma, [
    profile.name,
    profile.email.split('@')[0] ?? null,
  ])
  const displayName = safeDisplayName(profile.name, username).slice(0, DISPLAY_NAME_MAX)
  return prisma.$transaction(async (tx) => {
    const user = await createArtistAccount(tx, {
      email: profile.email,
      username,
      displayName,
      passwordHash: null,
      emailVerifiedAt: profile.emailVerified ? new Date() : null,
      membershipStatus: profile.emailVerified ? 'PENDING_PAYMENT' : 'PENDING_EMAIL',
    })
    await tx.oAuthAccount.create({
      data: {
        userId: user.id,
        provider,
        providerUserId: profile.providerUserId,
        email: profile.email,
      },
    })
    let verificationToken: string | null = null
    if (!profile.emailVerified) {
      verificationToken = generateVerificationToken()
      await tx.emailVerification.create({
        data: { userId: user.id, token: verificationToken, expiresAt: verificationExpiresAt() },
      })
    }
    return { ...user, verificationToken }
  })
}

/**
 * Decides what an OAuth callback does with a provider identity:
 * sign in its account, attach it to the signed-in user, link it to a
 * matching verified-email account, or create a new account.
 */
export async function resolveOAuthLogin(
  prisma: PrismaClient,
  provider: OAuthLoginProvider,
  profile: OAuthLoginProfile,
  linkUserId: string | null,
): Promise<OAuthResolution> {
  const existing = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerUserId: { provider, providerUserId: profile.providerUserId },
    },
    select: { userId: true },
  })

  if (linkUserId) {
    if (existing) {
      return existing.userId === linkUserId
        ? { kind: 'linked' }
        : { kind: 'error', code: 'already_linked', reason: 'identity belongs to another account' }
    }
    const linked = await linkIdentity(prisma, linkUserId, provider, profile)
    return linked
      ? { kind: 'linked' }
      : {
          kind: 'error',
          code: 'already_linked',
          reason: 'account already has an identity for this provider',
        }
  }

  if (existing) return { kind: 'sign_in', userId: existing.userId }

  if (!profile.email) {
    return { kind: 'error', code: 'failed', reason: 'provider returned no email' }
  }

  const byEmail = await prisma.user.findFirst({
    where: { email: { equals: profile.email, mode: 'insensitive' } },
    select: { id: true, emailVerifiedAt: true },
  })
  if (byEmail) {
    // Auto-linking is only safe when both sides proved ownership of the
    // address; an unverified Tahti signup may have been made by someone else.
    if (provider !== 'google' || !profile.emailVerified || !byEmail.emailVerifiedAt) {
      return { kind: 'error', code: 'email_in_use', reason: 'email belongs to an existing account' }
    }
    const linked = await linkIdentity(prisma, byEmail.id, provider, profile)
    if (!linked) {
      return {
        kind: 'error',
        code: 'already_linked',
        reason: 'account already has an identity for this provider',
      }
    }
    return { kind: 'sign_in', userId: byEmail.id }
  }

  try {
    const user = await createOAuthUser(prisma, provider, { ...profile, email: profile.email })
    return { kind: 'created', user }
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { kind: 'error', code: 'failed', reason: 'concurrent signup collided' }
    }
    throw err
  }
}
