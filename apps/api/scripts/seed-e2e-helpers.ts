// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Shared builders for the self-contained `seed-e2e-*` scripts. Each script
// stays runnable on its own (`npx tsx scripts/seed-e2e-<name>.ts`); this
// module only removes the copy-pasted user/channel bootstrap (same field
// values as before — the e2e journeys assert on them).

import { hashPassword } from '../src/lib/password.js'

export interface SeedAccount {
  email: string
  username: string
  displayName: string
}

export interface SeedChannelData {
  slug: string
  liveSourceMount: string
  liveSourcePass: string
  liveSourcePassHash: string
  rtmpStreamKey: string
  rtmpStreamKeyHash: string
  state: 'OFFLINE'
}

/** Channel row for a seed artist. Defaults follow the `<username>__e2e`
 * convention; pass explicit values when the journey depends on the exact
 * format (e.g. golive's `<username>__e2egolive` stream key, which
 * `routes/internal/rtmp.ts` splits on `__`). */
export async function buildSeedChannelData(
  username: string,
  opts: { rtmpStreamKey?: string; liveSourcePass?: string } = {},
): Promise<SeedChannelData> {
  const rtmpStreamKey = opts.rtmpStreamKey ?? `${username}__e2e`
  const liveSourcePass = opts.liveSourcePass ?? `pass-${username}`
  return {
    slug: username,
    liveSourceMount: `/live/${username}`,
    liveSourcePass,
    liveSourcePassHash: await hashPassword(liveSourcePass),
    rtmpStreamKey,
    rtmpStreamKeyHash: await hashPassword(rtmpStreamKey),
    state: 'OFFLINE',
  }
}

/** Base user row for a seed artist (verified, free tier). Callers spread
 * this into their `prisma.user.create/update` data and add script-specific
 * relations (membership, channel, …). */
export async function buildSeedUserData(account: SeedAccount, password: string) {
  return {
    email: account.email,
    passwordHash: await hashPassword(password),
    username: account.username,
    displayName: account.displayName,
    emailVerifiedAt: new Date(),
    tier: 'FREE' as const,
  }
}
