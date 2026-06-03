// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { downloadGrowthExceedsThreshold } from './download-fraud-scan.js'

describe('downloadGrowthExceedsThreshold', () => {
  it('ignores low absolute counts', () => {
    expect(downloadGrowthExceedsThreshold(9, 0)).toBe(false)
    expect(downloadGrowthExceedsThreshold(19, 1)).toBe(false)
    expect(downloadGrowthExceedsThreshold(20, 1)).toBe(true)
  })

  it('requires 20× growth vs prior day', () => {
    expect(downloadGrowthExceedsThreshold(199, 10)).toBe(false)
    expect(downloadGrowthExceedsThreshold(200, 10)).toBe(true)
  })

  it('uses baseline of 1 when prior day had zero downloads', () => {
    expect(downloadGrowthExceedsThreshold(19, 0)).toBe(false)
    expect(downloadGrowthExceedsThreshold(20, 0)).toBe(true)
  })
})
