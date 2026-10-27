// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@prisma/client'
import { availableUserWhere } from './available-user.js'

export type JobOutcome = {
  userId: string
  outcome: 'done' | 'failed'
  title: string
  body?: string | null
  url: string
}

/** Tells the owner how a background job they started ended — uploads that
 * fail to process, editor renders, stems, exports, imports, deliveries — so
 * they don't have to keep a page open to find out. Skips deleted or
 * suspended accounts. Never throws: the job's own state is already saved. */
export async function notifyJobOutcome(prisma: PrismaClient, job: JobOutcome): Promise<void> {
  try {
    const user = await prisma.user.findFirst({
      where: { id: job.userId, ...availableUserWhere },
      select: { id: true },
    })
    if (!user) return
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: job.outcome === 'done' ? 'BACKGROUND_JOB_DONE' : 'BACKGROUND_JOB_FAILED',
        title: job.title.slice(0, 200),
        body: job.body?.slice(0, 500) ?? null,
        url: job.url,
      },
    })
  } catch {
    // The notice is best-effort; a failed write must not fail the job.
  }
}
