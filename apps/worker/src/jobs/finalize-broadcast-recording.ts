// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { stat } from 'node:fs/promises'
import { prisma } from '@tahti/db'
import { broadcastSessionLogFields } from '@tahti/shared'
import { findLatestChannelRecording } from '../lib/channel-recording.js'
import { uploadFile } from '../lib/minio.js'
import { enqueueArchiveBroadcast } from '../lib/queue.js'

const RECORDINGS_ROOT = process.env.RECORDINGS_ROOT ?? '/recordings'
/** Skip accidental connect blips; partial disconnects above this are archived (ARTIST-001). */
const MIN_BYTES = parseInt(process.env.BROADCAST_RECORDING_MIN_BYTES ?? '262144', 10)

function logLine(fields: Record<string, unknown>, msg: string): void {
  console.log(JSON.stringify({ ...fields, msg, component: 'finalize-broadcast-recording' }))
}

export async function processFinalizeBroadcastRecordingJob(job: Job): Promise<void> {
  const { broadcastId } = job.data as { broadcastId: string }

  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    include: { channel: { select: { id: true, slug: true } } },
  })

  if (!broadcast) throw new Error(`Broadcast ${broadcastId} not found`)

  const base = broadcastSessionLogFields({
    broadcastId,
    channelId: broadcast.channel.id,
    slug: broadcast.channel.slug,
    source: broadcast.source,
  })

  if (broadcast.archiveItemId) {
    logLine(base, 'archive already linked, skipping')
    return
  }

  if (broadcast.recordingKey) {
    logLine(base, 'recordingKey already set, skipping scan')
    return
  }

  const localPath = await findLatestChannelRecording(
    RECORDINGS_ROOT,
    broadcast.channel.id,
    broadcast.startedAt,
  )

  if (!localPath) {
    logLine(base, 'no local recording file yet')
    throw new Error('recording not ready')
  }

  const st = await stat(localPath)
  if (st.size < MIN_BYTES) {
    logLine({ ...base, bytes: st.size }, 'recording too small, skipping archive')
    return
  }

  const recordingKey = `recordings/${broadcast.channel.slug}/broadcast-${broadcastId}.wav`
  await uploadFile(recordingKey, localPath, 'audio/wav')

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { recordingKey },
  })

  logLine({ ...base, recordingKey, bytes: st.size }, 'recording uploaded to MinIO')
  await enqueueArchiveBroadcast(broadcastId)
}
