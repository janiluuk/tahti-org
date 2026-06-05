// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

/** Record a Tahti Radio feature event and update channel rotation timestamp. */
export async function recordRadioFeature(prisma: PrismaClient, channelId: string): Promise<void> {
  const now = new Date()
  await prisma.$transaction([
    prisma.channel.update({
      where: { id: channelId },
      data: { lastFeaturedAt: now },
    }),
    prisma.radioFeatureLog.create({
      data: { channelId, featuredAt: now },
    }),
  ])
}

/** Eligible live channels for Tahti Radio, sorted by least-recently featured first. */
export async function listRadioEligibleChannels(prisma: PrismaClient) {
  const live = await prisma.channel.findMany({
    where: {
      state: 'LIVE',
      metaStreamOptOut: false,
      user: { isMember: true },
    },
    select: {
      id: true,
      slug: true,
      lastFeaturedAt: true,
      user: { select: { displayName: true } },
    },
  })

  live.sort((a, b) => {
    const ta = a.lastFeaturedAt?.getTime() ?? 0
    const tb = b.lastFeaturedAt?.getTime() ?? 0
    return ta - tb
  })

  return live
}

export async function getRadioFeatureHistory(prisma: PrismaClient, limit = 10) {
  const rows = await prisma.radioFeatureLog.findMany({
    orderBy: { featuredAt: 'desc' },
    take: limit,
    select: {
      featuredAt: true,
      channel: {
        select: {
          id: true,
          slug: true,
          user: { select: { displayName: true } },
        },
      },
    },
  })

  return rows.map((row) => ({
    channelId: row.channel.id,
    slug: row.channel.slug,
    artistName: row.channel.user.displayName,
    featuredAt: row.featuredAt,
  }))
}
