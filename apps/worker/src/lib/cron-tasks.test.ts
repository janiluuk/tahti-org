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

  it('parallel mode starts every task before any finishes and isolates failures', async () => {
    const started: string[] = []
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const pending = runCronTasks(
      {
        slow: async () => {
          started.push('slow')
          await gate
          return 1
        },
        fast: async () => {
          started.push('fast')
          throw new Error('boom')
        },
      },
      { parallel: true },
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(started).toEqual(['slow', 'fast'])
    release()
    expect(await pending).toEqual({ slow: 1, fast: { error: true } })
  })
})
