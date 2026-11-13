// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Prisma, MembershipStatus } from '@tahti/db'
import { nanoid } from 'nanoid'
import { safeDisplayName } from '@tahti/shared'
import { ensureChannelOwnerModerator } from './channel-owner-moderator.js'
import { hashPassword } from './password.js'

export async function createArtistAccount(
  tx: Prisma.TransactionClient,
  opts: {
    email: string
    username: string
    displayName: string
    passwordHash?: string | null
    emailVerifiedAt?: Date | null
    membershipStatus?: MembershipStatus
  },
) {
  const channelSlug = opts.username
  const liveSourceMount = `/live/${channelSlug}`
  const liveSourcePass = nanoid(24)
  const rtmpStreamKey = `${channelSlug}__${nanoid(32)}`
  const liveSourcePassHash = await hashPassword(liveSourcePass)
  const rtmpStreamKeyHash = await hashPassword(rtmpStreamKey)

  const user = await tx.user.create({
    data: {
      email: opts.email,
      passwordHash: opts.passwordHash ?? null,
      username: opts.username,
      displayName: safeDisplayName(opts.displayName, opts.username),
      emailVerifiedAt: opts.emailVerifiedAt ?? null,
      membership: {
        create: {
          status: opts.membershipStatus ?? 'PENDING_EMAIL',
        },
      },
      channel: {
        create: {
          slug: channelSlug,
          liveSourceMount,
          liveSourcePass,
          liveSourcePassHash,
          rtmpStreamKey,
          rtmpStreamKeyHash,
        },
      },
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      username: true,
      passwordHash: true,
      channel: { select: { id: true } },
    },
  })
  if (user.channel) {
    await ensureChannelOwnerModerator(tx, user.channel.id, user.id)
  }
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    username: user.username,
    passwordHash: user.passwordHash,
  }
}

export function suggestUsernameFromName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return base.length >= 2 ? base : 'artist'
}
