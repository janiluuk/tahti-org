// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { notifyJobOutcome, prisma } from '@tahti/db'
import { isFinalAttempt } from '../lib/sound-processing-error.js'
import { submitReleaseToRevelator } from '@tahti/revelator'

export async function processRevelatorDeliverJob(job: Job): Promise<void> {
  const { releaseId } = job.data as { releaseId: string }

  const release = await prisma.release.findUnique({
    where: { id: releaseId },
    select: {
      id: true,
      title: true,
      type: true,
      releaseDate: true,
      upc: true,
      pLine: true,
      cLine: true,
      labelImprint: true,
      revelatorStatus: true,
      userId: true,
      user: { select: { username: true, displayName: true } },
      tracks: {
        orderBy: { position: 'asc' },
        select: { position: true, title: true, isrc: true, durationSec: true },
      },
    },
  })

  if (!release) throw new Error(`Release ${releaseId} not found`)

  try {
    const result = await submitReleaseToRevelator({
      tahtiReleaseId: release.id,
      title: release.title,
      type: release.type,
      releaseDate: release.releaseDate.toISOString().slice(0, 10),
      upc: release.upc,
      pLine: release.pLine,
      cLine: release.cLine,
      labelImprint: release.labelImprint,
      artistDisplayName: release.user.displayName,
      artistUsername: release.user.username,
      tracks: release.tracks,
    })

    await prisma.release.update({
      where: { id: releaseId },
      data: {
        revelatorId: result.revelatorId,
        revelatorStatus: 'submitted',
      },
    })
    await notifyJobOutcome(prisma, {
      userId: release.userId,
      outcome: 'done',
      title: `"${release.title}" was sent for distribution`,
      body: 'Stores take a few days to a few weeks to list it.',
      url: `/studio/releases/${release.id}`,
    })
  } catch (err) {
    await prisma.release.update({
      where: { id: releaseId },
      data: {
        revelatorStatus: 'failed',
      },
    })
    if (job.opts && isFinalAttempt(job)) {
      await notifyJobOutcome(prisma, {
        userId: release.userId,
        outcome: 'failed',
        title: `"${release.title}" could not be sent for distribution`,
        body: 'Check the release details in Studio and send it again, or ask the board through Help → Support.',
        url: `/studio/releases/${release.id}`,
      })
    }
    throw err
  }
}
