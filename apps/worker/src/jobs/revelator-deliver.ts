// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { prisma } from '@tahti/db'
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
  } catch (err) {
    await prisma.release.update({
      where: { id: releaseId },
      data: {
        revelatorStatus: 'failed',
      },
    })
    throw err
  }
}
