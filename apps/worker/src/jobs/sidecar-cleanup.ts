// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { cleanupOrphanedSidecars } from '../lib/orchestrator.js'

/** Every 10 minutes, ask the orchestrator to remove recorder/fingerprint sidecar
 * containers whose broadcast has ended — see services/orchestrator/src/sidecar-cleanup.ts
 * for why this can't just rely on the orchestrator's own in-memory tracking. */
export async function processSidecarCleanupJob(
  _job: Job,
): Promise<{ checked: number; removed: string[] }> {
  return cleanupOrphanedSidecars()
}
