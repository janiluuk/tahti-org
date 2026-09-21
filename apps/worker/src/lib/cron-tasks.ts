// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { runWithCronLog } from './cron-run.js'

/** Run a dispatcher cron's sub-tasks. Each task gets its own CronRun row (named
 * after the task) and a failure never stops the other tasks. Failures are
 * recorded in CronRun rather than rethrown: BullMQ would retry the whole
 * dispatcher and re-run tasks that already succeeded (e.g. payouts).
 *
 * Tasks run one after another by default (use that when order matters).
 * `parallel: true` starts them together so a slow task (e.g. channel-watchdog
 * waiting on the orchestrator) cannot delay a time-sensitive one
 * (radio-slot-switchover) — use it for the independent per-minute ticks. */
export async function runCronTasks(
  tasks: Record<string, () => Promise<unknown>>,
  opts: { parallel?: boolean } = {},
): Promise<Record<string, unknown>> {
  const run = async (name: string, task: () => Promise<unknown>): Promise<unknown> => {
    try {
      return await runWithCronLog(name, task)
    } catch {
      // runWithCronLog already persisted and logged the error.
      return { error: true }
    }
  }

  const entries = Object.entries(tasks)
  if (opts.parallel) {
    const values = await Promise.all(entries.map(([name, task]) => run(name, task)))
    return Object.fromEntries(entries.map(([name], i) => [name, values[i]]))
  }

  const results: Record<string, unknown> = {}
  for (const [name, task] of entries) results[name] = await run(name, task)
  return results
}
