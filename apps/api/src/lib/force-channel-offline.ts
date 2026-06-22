// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import type { FastifyBaseLogger } from 'fastify'
import { broadcastSessionLogFields } from '@tahti/shared'
import { enqueueFinalizeBroadcastRecording } from './queue.js'
import { stopOrchestratorChannel } from './orchestrator.js'

/** M21-C: stop Liquidsoap, end open broadcast, set channel OFFLINE (mirrors icecast disconnect). */
export async function forceChannelOffline(
  prisma: PrismaClient,
  log: FastifyBaseLogger,
  params: { channelId: string; slug: string },
): Promise<void> {
  const { channelId, slug } = params

  await stopOrchestratorChannel(channelId)

  const broadcast = await prisma.broadcast.findFirst({
    where: { channelId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  })

  if (broadcast) {
    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { endedAt: new Date() },
    })
    // A session that never went LIVE (preview-only) has no public archive to finalize.
    if (broadcast.wentLiveAt) {
      enqueueFinalizeBroadcastRecording(broadcast.id).catch((err: unknown) =>
        log.error(
          {
            err,
            ...broadcastSessionLogFields({
              broadcastId: broadcast.id,
              channelId,
              slug,
              source: 'ADMIN',
            }),
          },
          'finalize-broadcast-recording enqueue failed (force offline)',
        ),
      )
    }
  }

  await prisma.channel.update({
    where: { id: channelId },
    data: { state: 'OFFLINE', goneLiveAt: null },
  })

  log.info(
    broadcast
      ? broadcastSessionLogFields({
          broadcastId: broadcast.id,
          channelId,
          slug,
          source: 'ADMIN',
        })
      : { slug, channelId },
    'channel forced offline',
  )
}
