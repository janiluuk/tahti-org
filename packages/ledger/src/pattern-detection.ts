// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export type PatternAnomalyCode =
  'BATCH_ACCOUNTS' | 'EVEN_INTERVALS' | 'NETWORK_CLUSTERS' | 'RECIPROCAL_RINGS'

export type PatternFlag = {
  channelId: string
  code: PatternAnomalyCode
  message: string
}

export const BATCH_ACCOUNT_WINDOW_MS = 48 * 60 * 60 * 1000
export const BATCH_ACCOUNT_MIN_USERS = 5
export const EVEN_INTERVAL_MIN_GAPS = 12
export const EVEN_INTERVAL_MAX_CV = 0.15
export const NETWORK_CLUSTER_MIN_TOTAL = 20
export const NETWORK_CLUSTER_TOP_N = 3
export const NETWORK_CLUSTER_MIN_SHARE = 0.7
export const RECIPROCAL_MIN_DOWNLOADS = 15
export const RECIPROCAL_MIN_JACCARD = 0.4
export const PATTERN_SCAN_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000
export const PATTERN_ALERT_DEDUP_MS = 7 * 24 * 60 * 60 * 1000

export type CountedDownloadRow = {
  channelId: string
  byIpHash: string
  byUserId: string | null
  countedAt: Date
}

export type DownloaderAccount = {
  userId: string
  createdAt: Date
}

/** Population coefficient of variation (σ / μ). Empty or zero-mean → Infinity. */
export function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return Number.POSITIVE_INFINITY
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  if (mean === 0) return Number.POSITIVE_INFINITY
  const variance = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / values.length
  return Math.sqrt(variance) / mean
}

export function detectEvenIntervals(
  timestampsMs: number[],
  minGaps = EVEN_INTERVAL_MIN_GAPS,
  maxCv = EVEN_INTERVAL_MAX_CV,
): { flagged: boolean; gapCount: number; cv: number } {
  if (timestampsMs.length < minGaps + 1) {
    return { flagged: false, gapCount: 0, cv: Number.POSITIVE_INFINITY }
  }
  const sorted = [...timestampsMs].sort((a, b) => a - b)
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i += 1) {
    gaps.push(sorted[i]! - sorted[i - 1]!)
  }
  const cv = coefficientOfVariation(gaps)
  return { flagged: gaps.length >= minGaps && cv <= maxCv, gapCount: gaps.length, cv }
}

export function detectNetworkClusters(
  ipCounts: Map<string, number>,
  minTotal = NETWORK_CLUSTER_MIN_TOTAL,
  topN = NETWORK_CLUSTER_TOP_N,
  minShare = NETWORK_CLUSTER_MIN_SHARE,
): { flagged: boolean; total: number; topShare: number; topIps: number } {
  let total = 0
  const counts: number[] = []
  for (const count of ipCounts.values()) {
    total += count
    counts.push(count)
  }
  if (total < minTotal) {
    return { flagged: false, total, topShare: 0, topIps: 0 }
  }
  counts.sort((a, b) => b - a)
  const top = counts.slice(0, topN).reduce((sum, n) => sum + n, 0)
  const topShare = top / total
  return {
    flagged: topShare >= minShare,
    total,
    topShare,
    topIps: Math.min(topN, counts.length),
  }
}

/** True when ≥minUsers accounts created within windowMs each downloaded the channel. */
export function detectBatchAccounts(
  accounts: DownloaderAccount[],
  windowMs = BATCH_ACCOUNT_WINDOW_MS,
  minUsers = BATCH_ACCOUNT_MIN_USERS,
): { flagged: boolean; clusterSize: number; windowStart: Date | null } {
  if (accounts.length < minUsers) {
    return { flagged: false, clusterSize: 0, windowStart: null }
  }
  const sorted = [...accounts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  let best = 0
  let bestStart: Date | null = null
  let left = 0
  for (let right = 0; right < sorted.length; right += 1) {
    while (sorted[right]!.createdAt.getTime() - sorted[left]!.createdAt.getTime() > windowMs) {
      left += 1
    }
    const size = right - left + 1
    if (size > best) {
      best = size
      bestStart = sorted[left]!.createdAt
    }
  }
  return {
    flagged: best >= minUsers,
    clusterSize: best,
    windowStart: bestStart,
  }
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const value of a) {
    if (b.has(value)) intersection += 1
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

export type ReciprocalPair = {
  channelA: string
  channelB: string
  score: number
}

export function detectReciprocalRings(
  ipsByChannel: Map<string, Set<string>>,
  minDownloadsByChannel: Map<string, number>,
  minDownloads = RECIPROCAL_MIN_DOWNLOADS,
  minJaccard = RECIPROCAL_MIN_JACCARD,
): ReciprocalPair[] {
  const channels = [...ipsByChannel.keys()].filter(
    (id) => (minDownloadsByChannel.get(id) ?? 0) >= minDownloads,
  )
  const pairs: ReciprocalPair[] = []
  for (let i = 0; i < channels.length; i += 1) {
    for (let j = i + 1; j < channels.length; j += 1) {
      const a = channels[i]!
      const b = channels[j]!
      const score = jaccardSimilarity(ipsByChannel.get(a)!, ipsByChannel.get(b)!)
      if (score >= minJaccard) {
        pairs.push({ channelA: a, channelB: b, score })
      }
    }
  }
  return pairs
}

export function flagsFromCountedDownloads(args: {
  downloads: CountedDownloadRow[]
  accountsByChannel: Map<string, DownloaderAccount[]>
}): PatternFlag[] {
  const { downloads, accountsByChannel } = args
  const byChannel = new Map<string, CountedDownloadRow[]>()
  for (const row of downloads) {
    const list = byChannel.get(row.channelId) ?? []
    list.push(row)
    byChannel.set(row.channelId, list)
  }

  const flags: PatternFlag[] = []
  const ipsByChannel = new Map<string, Set<string>>()
  const totalsByChannel = new Map<string, number>()

  for (const [channelId, rows] of byChannel) {
    totalsByChannel.set(channelId, rows.length)
    const ipCounts = new Map<string, number>()
    const ips = new Set<string>()
    const times: number[] = []
    for (const row of rows) {
      ipCounts.set(row.byIpHash, (ipCounts.get(row.byIpHash) ?? 0) + 1)
      ips.add(row.byIpHash)
      times.push(row.countedAt.getTime())
    }
    ipsByChannel.set(channelId, ips)

    const even = detectEvenIntervals(times)
    if (even.flagged) {
      flags.push({
        channelId,
        code: 'EVEN_INTERVALS',
        message: `Counted downloads have ${even.gapCount} gaps with CV ${even.cv.toFixed(3)} (≤ ${EVEN_INTERVAL_MAX_CV})`,
      })
    }

    const cluster = detectNetworkClusters(ipCounts)
    if (cluster.flagged) {
      flags.push({
        channelId,
        code: 'NETWORK_CLUSTERS',
        message: `Top ${cluster.topIps} IP hashes are ${Math.round(cluster.topShare * 100)}% of ${cluster.total} counted downloads`,
      })
    }

    const batch = detectBatchAccounts(accountsByChannel.get(channelId) ?? [])
    if (batch.flagged) {
      flags.push({
        channelId,
        code: 'BATCH_ACCOUNTS',
        message: `${batch.clusterSize} accounts created within 48h each have counted downloads on this channel`,
      })
    }
  }

  for (const pair of detectReciprocalRings(ipsByChannel, totalsByChannel)) {
    const pct = Math.round(pair.score * 100)
    const message = `Downloader IP overlap ${pct}% with another high-volume channel (reciprocal ring)`
    flags.push({
      channelId: pair.channelA,
      code: 'RECIPROCAL_RINGS',
      message,
    })
    flags.push({
      channelId: pair.channelB,
      code: 'RECIPROCAL_RINGS',
      message,
    })
  }

  return flags
}

async function loadCountedDownloads(
  prisma: PrismaClient,
  start: Date,
  end: Date,
): Promise<CountedDownloadRow[]> {
  const rows = await prisma.download.findMany({
    where: { countedAt: { gte: start, lt: end } },
    select: {
      channelId: true,
      byIpHash: true,
      byUserId: true,
      countedAt: true,
    },
  })
  return rows.filter((row): row is CountedDownloadRow & { countedAt: Date } =>
    Boolean(row.countedAt),
  )
}

async function loadDownloaderAccounts(
  prisma: PrismaClient,
  downloads: CountedDownloadRow[],
): Promise<Map<string, DownloaderAccount[]>> {
  const userIds = [
    ...new Set(downloads.map((row) => row.byUserId).filter((id): id is string => Boolean(id))),
  ]
  if (userIds.length === 0) return new Map()

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, createdAt: true },
  })
  const createdById = new Map(users.map((u) => [u.id, u.createdAt]))

  const byChannel = new Map<string, Map<string, DownloaderAccount>>()
  for (const row of downloads) {
    if (!row.byUserId) continue
    const createdAt = createdById.get(row.byUserId)
    if (!createdAt) continue
    const channelMap = byChannel.get(row.channelId) ?? new Map()
    if (!channelMap.has(row.byUserId)) {
      channelMap.set(row.byUserId, { userId: row.byUserId, createdAt })
    }
    byChannel.set(row.channelId, channelMap)
  }

  const result = new Map<string, DownloaderAccount[]>()
  for (const [channelId, accounts] of byChannel) {
    result.set(channelId, [...accounts.values()])
  }
  return result
}

/** Pattern flags for counted downloads in [start, end). */
export async function collectPatternFlags(
  prisma: PrismaClient,
  start: Date,
  end: Date,
): Promise<PatternFlag[]> {
  const downloads = await loadCountedDownloads(prisma, start, end)
  if (downloads.length === 0) return []
  const accountsByChannel = await loadDownloaderAccounts(prisma, downloads)
  return flagsFromCountedDownloads({ downloads, accountsByChannel })
}

/** Daily scan: write PATTERN_FRAUD_ALERT audits (7-day dedupe per channel+code). */
export async function processPatternFraudScan(
  prisma: PrismaClient,
  now = new Date(),
): Promise<{ flagged: number; channelsScanned: number }> {
  const end = now
  const start = new Date(now.getTime() - PATTERN_SCAN_LOOKBACK_MS)
  const flags = await collectPatternFlags(prisma, start, end)
  const channelIds = [...new Set(flags.map((f) => f.channelId))]
  if (channelIds.length === 0) {
    return { flagged: 0, channelsScanned: 0 }
  }

  const channels = await prisma.channel.findMany({
    where: { id: { in: channelIds } },
    select: { id: true, slug: true, userId: true },
  })
  const channelById = new Map(channels.map((c) => [c.id, c]))

  let flagged = 0
  const dedupeSince = new Date(now.getTime() - PATTERN_ALERT_DEDUP_MS)

  for (const flag of flags) {
    const channel = channelById.get(flag.channelId)
    if (!channel) continue

    const recent = await prisma.auditLog.findMany({
      where: {
        action: 'PATTERN_FRAUD_ALERT',
        targetId: channel.id,
        createdAt: { gte: dedupeSince },
      },
      select: { meta: true },
    })
    if (recent.some((row) => (row.meta as { code?: string } | null)?.code === flag.code)) {
      continue
    }

    await prisma.auditLog.create({
      data: {
        action: 'PATTERN_FRAUD_ALERT',
        actorId: 'system',
        targetId: channel.id,
        meta: {
          code: flag.code,
          message: flag.message,
          channelSlug: channel.slug,
          artistUserId: channel.userId,
        },
      },
    })
    flagged += 1
  }

  return { flagged, channelsScanned: channelIds.length }
}
