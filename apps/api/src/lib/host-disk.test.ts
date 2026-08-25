// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'

const statfsMock = vi.fn()

vi.mock('node:fs/promises', () => ({
  statfs: (...args: unknown[]) => statfsMock(...args),
}))

describe('getHostDiskSpace', () => {
  beforeEach(() => {
    statfsMock.mockReset()
  })

  it('converts statfs blocks into byte totals using bavail for free space', async () => {
    const { getHostDiskSpace } = await import('./host-disk.js')
    statfsMock.mockResolvedValue({
      bsize: 4096,
      blocks: 1000,
      bfree: 500,
      bavail: 400,
    })

    const result = await getHostDiskSpace('/data')

    expect(statfsMock).toHaveBeenCalledWith('/data')
    expect(result).toEqual({
      totalBytes: 1000 * 4096,
      freeBytes: 400 * 4096,
      usedBytes: 1000 * 4096 - 500 * 4096,
    })
  })

  it('returns null when statfs fails (e.g. path unmounted/permission denied)', async () => {
    const { getHostDiskSpace } = await import('./host-disk.js')
    statfsMock.mockRejectedValue(new Error('ENOENT'))

    const result = await getHostDiskSpace('/nope')

    expect(result).toBeNull()
  })
})
