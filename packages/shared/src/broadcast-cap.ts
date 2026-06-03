// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ArtistTier, PrismaClient } from '@tahti/db'

// M20: free-tier artists get 1 hour of live broadcasting per UTC calendar week.

export const FREE_WEEKLY_LIVE_CAP_SEC = 3600
/** M20: live continues this many seconds after the weekly cap before disconnect. */
export const FREE_WEEKLY_LIVE_GRACE_SEC = 60
export const FREE_WEEKLY_HARD_CAP_SEC = FREE_WEEKLY_LIVE_CAP_SEC + FREE_WEEKLY_LIVE_GRACE_SEC
export const WARN_SECONDS = [45 * 60, 55 * 60] as const

export function isUnlimitedLiveTier(tier: ArtistTier): boolean {
  return tier !== 'FREE'
}

/** Monday 00:00 UTC for the week containing `date`. */
export function utcWeekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

export async function ensureWeeklyReset(
  prisma: PrismaClient,
  userId: string,
  weeklyLiveResetAt: Date | null,
): Promise<void> {
  const weekStart = utcWeekStart(new Date())
  if (!weeklyLiveResetAt || weeklyLiveResetAt < weekStart) {
    await prisma.user.update({
      where: { id: userId },
      data: { weeklyLiveSecondsUsed: 0, weeklyLiveResetAt: weekStart },
    })
  }
}

export type BroadcastCapResult =
  | {
      allowed: true
      secondsUsed: number
      secondsRemaining: number | null
      warnings: number[]
      inGrace: boolean
    }
  | { allowed: false; reason: 'weekly_cap'; secondsUsed: number }

export async function checkBroadcastCap(
  prisma: PrismaClient,
  userId: string,
  tier: ArtistTier,
): Promise<BroadcastCapResult> {
  if (isUnlimitedLiveTier(tier)) {
    return {
      allowed: true,
      secondsUsed: 0,
      secondsRemaining: null,
      warnings: [],
      inGrace: false,
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { weeklyLiveSecondsUsed: true, weeklyLiveResetAt: true },
  })
  if (!user) return { allowed: false, reason: 'weekly_cap', secondsUsed: FREE_WEEKLY_LIVE_CAP_SEC }

  await ensureWeeklyReset(prisma, userId, user.weeklyLiveResetAt)
  const refreshed = await prisma.user.findUnique({
    where: { id: userId },
    select: { weeklyLiveSecondsUsed: true },
  })
  const used = refreshed?.weeklyLiveSecondsUsed ?? 0

  if (used >= FREE_WEEKLY_HARD_CAP_SEC) {
    return { allowed: false, reason: 'weekly_cap', secondsUsed: used }
  }

  const inGrace = used >= FREE_WEEKLY_LIVE_CAP_SEC
  const warnings = WARN_SECONDS.filter((w) => used >= w && used < FREE_WEEKLY_LIVE_CAP_SEC)
  return {
    allowed: true,
    secondsUsed: used,
    secondsRemaining: inGrace ? 0 : FREE_WEEKLY_LIVE_CAP_SEC - used,
    warnings,
    inGrace,
  }
}

/** Whether a new Icecast/RTMP source connection may start (reconnect allowed during grace if already LIVE). */
export function canAcceptSourceConnect(cap: BroadcastCapResult, channelState: string): boolean {
  if (!cap.allowed) return false
  if (cap.inGrace && channelState !== 'LIVE') return false
  return true
}

/** Increment live seconds for all FREE-tier users on currently LIVE channels. */
export async function tickWeeklyLiveSeconds(prisma: PrismaClient): Promise<number> {
  const liveChannels = await prisma.channel.findMany({
    where: { state: 'LIVE' },
    select: { userId: true, user: { select: { tier: true, weeklyLiveResetAt: true } } },
  })

  let updated = 0
  for (const ch of liveChannels) {
    if (isUnlimitedLiveTier(ch.user.tier)) continue
    await ensureWeeklyReset(prisma, ch.userId, ch.user.weeklyLiveResetAt)
    await prisma.user.update({
      where: { id: ch.userId },
      data: { weeklyLiveSecondsUsed: { increment: 60 } },
    })
    updated++
  }
  return updated
}

export async function resetFreeWeeklyLiveCounters(prisma: PrismaClient): Promise<number> {
  const weekStart = utcWeekStart(new Date())
  const result = await prisma.user.updateMany({
    where: { tier: 'FREE' },
    data: { weeklyLiveSecondsUsed: 0, weeklyLiveResetAt: weekStart },
  })
  return result.count
}

/** End live broadcasts for FREE users who exceeded the weekly cap. */
export async function enforceWeeklyCapDisconnects(prisma: PrismaClient): Promise<string[]> {
  const overCap = await prisma.user.findMany({
    where: { tier: 'FREE', weeklyLiveSecondsUsed: { gte: FREE_WEEKLY_HARD_CAP_SEC } },
    select: { id: true, channel: { select: { id: true, state: true } } },
  })

  const stoppedChannelIds: string[] = []
  for (const u of overCap) {
    if (!u.channel || u.channel.state !== 'LIVE') continue
    const broadcast = await prisma.broadcast.findFirst({
      where: { channelId: u.channel.id, endedAt: null },
      orderBy: { startedAt: 'desc' },
    })
    if (broadcast) {
      await prisma.broadcast.update({
        where: { id: broadcast.id },
        data: { endedAt: new Date() },
      })
    }
    await prisma.channel.update({
      where: { id: u.channel.id },
      data: { state: 'OFFLINE', goneLiveAt: null },
    })
    stoppedChannelIds.push(u.channel.id)
  }
  return stoppedChannelIds
}
