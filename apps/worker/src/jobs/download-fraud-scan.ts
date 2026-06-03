// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { prisma } from '@tahti/db'
import { processDownloadFraudScan } from '@tahti/ledger'

export async function processDownloadFraudScanJob(_job: Job): Promise<void> {
  const summary = await processDownloadFraudScan(prisma)
  console.log('[worker] download-fraud-scan:', JSON.stringify(summary))
}
