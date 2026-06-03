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

// lastFeaturedAt per channelId — resets on restart (in-memory is fine for M16)
const lastFeatured = new Map<string, Date>()

export async function pickChannel(): Promise<PickedChannel | null> {
  const live = await prisma.channel.findMany({
    where: {
      state: 'LIVE',
      metaStreamOptOut: false,
      user: { isMember: true },
    },
    select: {
      id: true,
      slug: true,
      user: { select: { displayName: true } },
    },
  })

  if (live.length === 0) return null

  // Sort by last featured ascending (never featured → epoch 0)
  live.sort((a, b) => {
    const ta = lastFeatured.get(a.id)?.getTime() ?? 0
    const tb = lastFeatured.get(b.id)?.getTime() ?? 0
    return ta - tb
  })

  const picked = live[0]!
  lastFeatured.set(picked.id, new Date())

  return {
    channelId: picked.id,
    slug: picked.slug,
    artistName: picked.user.displayName,
    hlsUrl: `${HLS_BASE}/${picked.slug}/index.m3u8`,
  }
}
