// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import type { PrismaClient } from '@tahti/db'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import { restartChannelLiquidsoap, spawnOrchestratorChannel } from '../lib/orchestrator.js'

export interface RadioSlotSwitchoverResult {
  liveArtistSlug: string | null
  switched: boolean
}

/**
 * Keeps Tahti Radio's Liquidsoap live input in sync with the current
 * RadioSlotBooking (if any): a booked artist's slug while their slot is
 * active, or null (the channel's own dead mount, so fallback() plays the
 * curated rotation) otherwise. Only restarts Liquidsoap when the desired
 * source actually changes — every other tick is a cheap no-op.
 */
export async function processRadioSlotSwitchoverJob(
  prisma: PrismaClient,
  _job: Job,
): Promise<RadioSlotSwitchoverResult> {
  const channel = await prisma.channel.findUnique({
    where: { slug: TAHTI_RADIO_SLUG },
    select: { id: true, liveInputOverrideSlug: true, state: true },
  })
  if (!channel) return { liveArtistSlug: null, switched: false }

  // Persistent placeholder broadcast — mirrors Tahti Selects' rotation-stream
  // pattern (the channel template needs a BROADCAST_ID; Tahti Radio never has a
  // "real" per-session go-live broadcast of its own).
  let broadcast = await prisma.broadcast.findFirst({
    where: { channelId: channel.id, endedAt: null },
  })
  if (!broadcast) {
    broadcast = await prisma.broadcast.create({
      data: { channelId: channel.id, source: 'ICECAST' },
    })
  }

  // Cheap and idempotent — orchestrator no-ops if this channel is already
  // tracked, so this only ever does real work after an orchestrator restart,
  // and never causes an audio glitch on its own.
  const running = await spawnOrchestratorChannel(
    channel.id,
    TAHTI_RADIO_SLUG,
    broadcast.id,
    'channel',
  )

  // Tahti Radio has no artist pushing to its own Icecast mount, so the usual
  // on_connect webhook that flips regular channels to LIVE never fires here —
  // without this, `state` stays OFFLINE forever even while Liquidsoap is
  // genuinely streaming the rotation, and the public radio page never gets a
  // real hlsUrl (falls back to the legacy placeholder instead). Mirror the
  // failure case too — an honest "temporarily offline" beats a LIVE badge
  // pointing at dead audio.
  const desiredState = running ? 'LIVE' : 'OFFLINE'
  if (channel.state !== desiredState) {
    await prisma.channel.update({ where: { id: channel.id }, data: { state: desiredState } })
  }

  const now = new Date()
  const active = await prisma.radioSlotBooking.findFirst({
    where: { startAt: { lte: now }, endAt: { gt: now } },
    orderBy: { startAt: 'asc' },
    select: { channel: { select: { slug: true } } },
  })
  const desiredSlug = active?.channel.slug ?? null

  if (desiredSlug === channel.liveInputOverrideSlug) {
    return { liveArtistSlug: desiredSlug, switched: false }
  }

  await prisma.channel.update({
    where: { id: channel.id },
    data: { liveInputOverrideSlug: desiredSlug },
  })
  await restartChannelLiquidsoap(channel.id, TAHTI_RADIO_SLUG, broadcast.id, 'channel')

  console.log(
    `[radio-slot-switchover] Tahti Radio live input -> ${desiredSlug ?? '(rotation fallback)'}`,
  )

  return { liveArtistSlug: desiredSlug, switched: true }
}
