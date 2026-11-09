// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { BroadcastSource, PrismaClient } from '@tahti/db'
import type { FastifyBaseLogger } from 'fastify'
import {
  BROADCAST_RECONNECT_GRACE_MS,
  broadcastSessionLogFields,
  ingestStateFor,
  type IngestState,
} from '@tahti/shared'
import { endBroadcast } from '@tahti/shared/broadcast-end'
import { enqueueFinalizeBroadcastRecording } from './queue.js'
import { restartChannelLiquidsoap } from './orchestrator.js'

/**
 * Encoder dropped. A LIVE show is held open as reconnecting instead of ending, so a
 * flaky connection doesn't cut the show and split its recording. Returns the held
 * broadcast id, or null when the caller should end the session as before.
 */
export async function holdLiveSessionForReconnect(
  prisma: PrismaClient,
  channel: { id: string; state: string },
  now: Date = new Date(),
): Promise<string | null> {
  if (channel.state !== 'LIVE') return null
  const broadcast = await prisma.broadcast.findFirst({
    where: { channelId: channel.id, endedAt: null },
    orderBy: { startedAt: 'desc' },
    select: { id: true, wentLiveAt: true, ingestDisconnectedAt: true },
  })
  if (!broadcast?.wentLiveAt) return null
  if (!broadcast.ingestDisconnectedAt) {
    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { ingestDisconnectedAt: now },
    })
  }
  return broadcast.id
}

/**
 * Encoder connected while a show is reconnecting. Within the grace period and on the
 * same ingest protocol it resumes that show (returns its id). Otherwise the held show
 * is ended and its recording queued, and the caller starts a new session.
 */
export async function resumeReconnectingSession(
  prisma: PrismaClient,
  log: FastifyBaseLogger,
  channel: { id: string; slug: string; autoRecordEnabled: boolean },
  source: BroadcastSource,
  now: Date = new Date(),
): Promise<string | null> {
  const held = await prisma.broadcast.findFirst({
    where: { channelId: channel.id, endedAt: null, ingestDisconnectedAt: { not: null } },
    orderBy: { startedAt: 'desc' },
    select: { id: true, source: true, wentLiveAt: true, ingestDisconnectedAt: true },
  })
  if (!held) return null

  const withinGrace =
    now.getTime() - held.ingestDisconnectedAt!.getTime() <= BROADCAST_RECONNECT_GRACE_MS
  if (withinGrace && held.source === source) {
    const resumed = await prisma.broadcast.updateMany({
      where: { id: held.id, endedAt: null },
      data: { ingestDisconnectedAt: null },
    })
    if (resumed.count === 1) return held.id
    return null
  }

  if ((await endBroadcast(prisma, held.id, now)) && held.wentLiveAt && channel.autoRecordEnabled) {
    enqueueFinalizeBroadcastRecording(held.id).catch((err: unknown) =>
      log.error(
        {
          err,
          ...broadcastSessionLogFields({
            broadcastId: held.id,
            channelId: channel.id,
            slug: channel.slug,
            source: held.source,
          }),
        },
        'finalize-broadcast-recording enqueue failed (reconnect replaced)',
      ),
    )
  }
  return null
}

export async function channelIngestState(
  prisma: PrismaClient,
  channel: { id: string; state: string },
): Promise<{ ingest: IngestState; reconnectDeadline: string | null }> {
  const broadcast =
    channel.state === 'OFFLINE'
      ? null
      : await prisma.broadcast.findFirst({
          where: { channelId: channel.id, endedAt: null },
          orderBy: { startedAt: 'desc' },
          select: { wentLiveAt: true, ingestDisconnectedAt: true },
        })
  const { ingest, reconnectDeadline } = ingestStateFor(channel.state, broadcast)
  return { ingest, reconnectDeadline: reconnectDeadline?.toISOString() ?? null }
}

/**
 * The orchestrator leaves multistream mirrors out of Liquidsoap while a PRIVATE
 * session is open, but only when it renders the config. A container that was
 * already running (24/7 fallback) or a visibility change during PREVIEW needs a
 * re-render. No-op for channels without enabled mirror targets.
 */
export async function rerenderMirrorsForSession(
  prisma: PrismaClient,
  log: FastifyBaseLogger,
  channel: { id: string; slug: string },
  broadcastId: string,
): Promise<void> {
  const targets = await prisma.rtmpTarget.count({ where: { channelId: channel.id, enabled: true } })
  if (targets === 0) return
  await restartChannelLiquidsoap(channel.id, channel.slug, broadcastId).catch((err: unknown) =>
    log.error({ err, channelId: channel.id, broadcastId }, 'liquidsoap mirror re-render failed'),
  )
}
