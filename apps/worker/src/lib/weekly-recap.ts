// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { APP_URL, sendWorkerMail } from './mailer.js'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export interface WeeklyRecapNumbers {
  plays: number
  downloads: number
  newFollowers: number
  newFanSubscribers: number
  earnedCents: number
}

export function weeklyRecapText(displayName: string, n: WeeklyRecapNumbers): string {
  const money = `€${(n.earnedCents / 100).toFixed(2)}`
  return [
    `Hi ${displayName},`,
    '',
    'Your week on Tahti:',
    '',
    `• ${n.plays.toLocaleString('en')} plays`,
    `• ${n.downloads.toLocaleString('en')} downloads`,
    `• ${n.newFollowers.toLocaleString('en')} new followers`,
    `• ${n.newFanSubscribers.toLocaleString('en')} new fan subscribers`,
    `• ${money} from fans (subscriptions and purchases, before fees)`,
    '',
    `Your stats: ${APP_URL}/studio`,
    '',
    'You can turn this email off in Settings → Notifications.',
    '',
    '— Tahti',
  ].join('\n')
}

async function numbersFor(
  prisma: PrismaClient,
  artist: { id: string; channelId: string },
  since: Date,
): Promise<WeeklyRecapNumbers> {
  const [plays, downloads, newFollowers, newFanSubscribers, subPayments, purchases] =
    await Promise.all([
      prisma.listenEvent.count({
        where: { playedAt: { gte: since }, sound: { channelId: artist.channelId } },
      }),
      prisma.download.count({
        where: { channelId: artist.channelId, countedAt: { not: null }, createdAt: { gte: since } },
      }),
      prisma.artistFollow.count({ where: { artistUserId: artist.id, createdAt: { gte: since } } }),
      prisma.fanSubscription.count({
        where: { artistUserId: artist.id, createdAt: { gte: since } },
      }),
      prisma.fanSubPayout.aggregate({
        where: { artistUserId: artist.id, createdAt: { gte: since } },
        _sum: { grossCents: true },
      }),
      prisma.purchase.aggregate({
        where: { artistUserId: artist.id, state: 'PAID', createdAt: { gte: since } },
        _sum: { amountCents: true },
      }),
    ])
  return {
    plays,
    downloads,
    newFollowers,
    newFanSubscribers,
    earnedCents: (subPayments._sum.grossCents ?? 0) + (purchases._sum.amountCents ?? 0),
  }
}

/** Sunday email to each artist who wants it ("Weekly recap" in Settings →
 * Notifications) and had any activity in the last seven days. */
export async function processWeeklyRecaps(prisma: PrismaClient, now: Date = new Date()) {
  const since = new Date(now.getTime() - WEEK_MS)
  const artists = await prisma.user.findMany({
    where: {
      notifyWeeklyRecapEmail: true,
      emailVerifiedAt: { not: null },
      deletedAt: null,
      suspendedAt: null,
      channel: { isNot: null },
    },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      channel: { select: { id: true } },
    },
  })

  let sent = 0
  let quiet = 0
  let failed = 0
  for (const artist of artists) {
    if (!artist.channel) continue
    const numbers = await numbersFor(prisma, { id: artist.id, channelId: artist.channel.id }, since)
    if (Object.values(numbers).every((v) => v === 0)) {
      quiet++
      continue
    }
    try {
      await sendWorkerMail({
        to: artist.email,
        subject: `Your week on Tahti: ${numbers.plays.toLocaleString('en')} plays`,
        text: weeklyRecapText(artist.displayName || artist.username, numbers),
      })
      sent++
    } catch (err) {
      failed++
      console.error(`[weekly-recap] failed to send to ${artist.id}:`, err)
    }
  }
  return { sent, quiet, failed }
}
