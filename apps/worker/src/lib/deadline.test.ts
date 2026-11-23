// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DeadlineExceededError, withDeadline } from './deadline.js'

describe('withDeadline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves with the work when it finishes in time', async () => {
    await expect(withDeadline(Promise.resolve('done'), 1000, 'store')).resolves.toBe('done')
  })

  it('rejects with the step name when the work hangs', async () => {
    const hung = new Promise<never>(() => {})
    const result = withDeadline(hung, 5000, 'download')
    const assertion = expect(result).rejects.toThrow(DeadlineExceededError)
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
    await expect(result).rejects.toThrow('download timed out after 5s')
  })
})
