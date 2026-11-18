// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import type { PrismaClient } from '@tahti/db'
import { TAHTI_RADIO_SLUG, TAHTI_SELECTS_SLUG } from '@tahti/shared'
import { spawnOrchestratorChannel } from '../lib/orchestrator.js'

export interface ChannelFallbackReconcilerResult {
  checked: number
  started: number
}

/**
 * Bootstraps every fallback-enabled artist channel that's sitting OFFLINE into a
 * running 24/7 Liquidsoap container, mirroring the placeholder-broadcast pattern
 * Tahti Radio/Selects already use (see radio-slot-switchover.ts and
 * seed-tahti-selects-content.ts) — a Broadcast row that's never ended, so the
 * existing watchdog/restart machinery (which requires a broadcastId) works
 * unmodified. This only handles the one-time bootstrap: once a channel is LIVE,
 * channel-watchdog.ts already keeps any state:'LIVE' channel healthy generically.
 * Tahti Radio is excluded — `radio-slot-switchover` owns its spawn/restart.
 * Tahti Selects is included here so an OFFLINE curated channel is brought back
 * with the rotation template (it has no dedicated minute job of its own).
 */
export async function processChannelFallbackReconcilerJob(
  prisma: PrismaClient,
  _job: Job,
): Promise<ChannelFallbackReconcilerResult> {
  const channels = await prisma.channel.findMany({
    where: {
      state: 'OFFLINE',
      OR: [{ fallbackEnabled: true }, { slug: TAHTI_SELECTS_SLUG }],
      slug: { not: TAHTI_RADIO_SLUG },
    },
    select: { id: true, slug: true },
  })

  let started = 0
  for (const ch of channels) {
    let broadcast = await prisma.broadcast.findFirst({
      where: { channelId: ch.id, endedAt: null },
    })
    if (!broadcast) {
      broadcast = await prisma.broadcast.create({
        data: { channelId: ch.id, source: 'ICECAST' },
      })
    }

    const template = ch.slug === TAHTI_SELECTS_SLUG ? 'rotation' : 'channel'
    const running = await spawnOrchestratorChannel(ch.id, ch.slug, broadcast.id, template)
    if (running) {
      await prisma.channel.update({ where: { id: ch.id }, data: { state: 'LIVE' } })
      started++
    }
  }

  return { checked: channels.length, started }
}
