// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// M16 — TahtiRadioPicker: selects which live channel to relay on Tahti Radio.
//
// Selection rules (from AGENT.md M16):
//   1. Only channels currently LIVE with metaStreamOptOut = false
//   2. Members in good standing (isMember = true)
//   3. Fair rotation: prefer the channel that was featured least recently
//
// No editorial curation. The director has no programming control.

import { prisma } from '@tahti/db'

export interface PickedChannel {
  channelId: string
  slug: string
  artistName: string
  hlsUrl: string
}

const HLS_BASE = process.env.HLS_BASE_URL ?? 'http://localhost:9000/hls-live'

async function recordFeatured(channelId: string): Promise<void> {
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

/** Pick the next channel; persist rotation only when the featured channel changes. */
export async function pickChannel(currentChannelId: string | null): Promise<PickedChannel | null> {
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

  if (live.length === 0) return null

  live.sort((a, b) => {
    const ta = a.lastFeaturedAt?.getTime() ?? 0
    const tb = b.lastFeaturedAt?.getTime() ?? 0
    return ta - tb
  })

  const picked = live[0]!

  if (picked.id !== currentChannelId) {
    await recordFeatured(picked.id)
  }

  return {
    channelId: picked.id,
    slug: picked.slug,
    artistName: picked.user.displayName,
    hlsUrl: `${HLS_BASE}/${picked.slug}/index.m3u8`,
  }
}
