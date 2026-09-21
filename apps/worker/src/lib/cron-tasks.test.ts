// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it, vi } from 'vitest'

vi.mock('./cron-run.js', () => ({
  runWithCronLog: async (_name: string, fn: () => Promise<unknown>) => fn(),
}))

import { runCronTasks } from './cron-tasks.js'

describe('runCronTasks', () => {
  it('runs tasks in order and keeps going after a failure', async () => {
    const order: string[] = []
    const results = await runCronTasks({
      a: async () => {
        order.push('a')
        return { ok: 1 }
      },
      b: async () => {
        order.push('b')
        throw new Error('boom')
      },
      c: async () => {
        order.push('c')
        return { ok: 3 }
      },
    })
    expect(order).toEqual(['a', 'b', 'c'])
    expect(results).toEqual({ a: { ok: 1 }, b: { error: true }, c: { ok: 3 } })
  })
})
