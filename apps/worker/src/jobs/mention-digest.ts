// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { prisma } from '@tahti/db'
import { processMentionDigests } from '../lib/mention-digest.js'

export async function processMentionDigestJob(_job: Job): Promise<void> {
  const summary = await processMentionDigests(prisma)
  console.log('[worker] mention-digest:', JSON.stringify(summary))
}
