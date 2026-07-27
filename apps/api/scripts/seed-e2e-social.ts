// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Seeds three throwaway accounts for tests/e2e/social-and-messaging.mjs — one
 * "main" user plus two "friends" the main user follows, DMs, and chats with.
 * Idempotent: wipes any prior run's rows before recreating, same convention as
 * seed-demo-accounts.ts / seed-e2e-screenshots.ts.
 *
 * Run (stack): docker compose exec api tsx apps/api/scripts/seed-e2e-social.ts
 * Run (host):  cd apps/api && pnpm exec tsx scripts/seed-e2e-social.ts
 */

import { prisma } from '@tahti/db'
import { hashPassword } from '../src/lib/password.js'

export const E2E_SOCIAL_PASS = 'e2e-social-pass'

export const MAIN = {
  email: 'e2e-social-main@mock.tahti.live',
  username: 'e2e-social-main',
  displayName: 'E2E Social Main',
}
export const FRIEND_A = {
  email: 'e2e-social-friend-a@mock.tahti.live',
  username: 'e2e-social-friend-a',
  displayName: 'E2E Social Friend A',
}
export const FRIEND_B = {
  email: 'e2e-social-friend-b@mock.tahti.live',
  username: 'e2e-social-friend-b',
  displayName: 'E2E Social Friend B',
}

const ALL = [MAIN, FRIEND_A, FRIEND_B]

async function main() {
  const passwordHash = await hashPassword(E2E_SOCIAL_PASS)

  // Idempotent: wipe any prior run's rows before recreating.
  for (const { email } of ALL) {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) await prisma.user.delete({ where: { id: existing.id } })
  }

  for (const account of ALL) {
    await prisma.user.create({
      data: {
        email: account.email,
        passwordHash,
        username: account.username,
        displayName: account.displayName,
        emailVerifiedAt: new Date(),
        tier: 'FREE',
        isMember: false,
        channel: {
          create: {
            slug: account.username,
            liveSourceMount: `/live/${account.username}`,
            liveSourcePass: `pass-${account.username}`,
            liveSourcePassHash: await hashPassword(`pass-${account.username}`),
            rtmpStreamKey: `${account.username}__e2e`,
            rtmpStreamKeyHash: await hashPassword(`${account.username}__e2e`),
            state: 'OFFLINE',
          },
        },
      },
    })
  }

  console.log(
    JSON.stringify({
      password: E2E_SOCIAL_PASS,
      main: MAIN,
      friendA: FRIEND_A,
      friendB: FRIEND_B,
    }),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
