// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { prisma, closeStaleListenSessions } from '@tahti/db'

export async function processListenSessionCloseJob(_job: Job): Promise<void> {
  const summary = await closeStaleListenSessions(prisma)
  if (summary.closed > 0) {
    console.log('[worker] listen-session-close:', JSON.stringify(summary))
  }
}
