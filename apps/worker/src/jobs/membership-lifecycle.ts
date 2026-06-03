// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { prisma } from '@tahti/db'
import {
  processMembershipLapse,
  processMembershipRenewalReminders,
} from '../lib/membership-lifecycle.js'

export async function processMembershipRenewalJob(_job: Job): Promise<void> {
  const summary = await processMembershipRenewalReminders(prisma)
  console.log('[worker] membership-renewal-reminder:', JSON.stringify(summary))
}

export async function processMembershipLapseJob(_job: Job): Promise<void> {
  const summary = await processMembershipLapse(prisma)
  console.log('[worker] membership-lapse:', JSON.stringify(summary))
}
