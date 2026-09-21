// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { runWithCronLog } from './cron-run.js'

/** Run a dispatcher cron's sub-tasks one after another. Each task gets its own
 * CronRun row (named after the task) and a failure never stops the tasks after
 * it. Failures are recorded in CronRun rather than rethrown: BullMQ would retry
 * the whole dispatcher and re-run tasks that already succeeded (e.g. payouts). */
export async function runCronTasks(
  tasks: Record<string, () => Promise<unknown>>,
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {}
  for (const [name, task] of Object.entries(tasks)) {
    try {
      results[name] = await runWithCronLog(name, task)
    } catch {
      // runWithCronLog already persisted and logged the error.
      results[name] = { error: true }
    }
  }
  return results
}
