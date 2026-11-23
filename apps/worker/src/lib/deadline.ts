// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export class DeadlineExceededError extends Error {
  constructor(
    readonly step: string,
    readonly timeoutMs: number,
  ) {
    super(`${step} timed out after ${Math.round(timeoutMs / 1000)}s`)
    this.name = 'DeadlineExceededError'
  }
}

/**
 * Rejects with DeadlineExceededError when `work` has not settled within
 * `timeoutMs`. The work itself is not cancelled; callers use this for I/O
 * that has no timeout of its own (S3 transfers) so a hung request fails the
 * job instead of holding the queue.
 */
export async function withDeadline<T>(
  work: Promise<T>,
  timeoutMs: number,
  step: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DeadlineExceededError(step, timeoutMs)), timeoutMs)
  })
  try {
    return await Promise.race([work, deadline])
  } finally {
    clearTimeout(timer)
  }
}
