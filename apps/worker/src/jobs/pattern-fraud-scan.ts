// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { prisma } from '@tahti/db'
import { processPatternFraudScan } from '@tahti/ledger'

export async function processPatternFraudScanJob(_job: Job): Promise<void> {
  const summary = await processPatternFraudScan(prisma)
  console.log('[worker] pattern-fraud-scan:', JSON.stringify(summary))
}
