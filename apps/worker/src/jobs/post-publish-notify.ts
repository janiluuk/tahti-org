// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { prisma, processScheduledPostNotifications } from '@tahti/db'

export async function processPostPublishNotifyJob(_job: Job): Promise<void> {
  const summary = await processScheduledPostNotifications(prisma)
  console.log('[worker] post-publish-notify:', JSON.stringify(summary))
}
