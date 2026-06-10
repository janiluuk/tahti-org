// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { fetchRoyaltyReports, isRevelatorConfigured } from './index.js'

describe('fetchRoyaltyReports stub mode', () => {
  it('returns deterministic stub rows per release and month', async () => {
    const prev = process.env.REVELATOR_API_KEY
    const prevFile = process.env.REVELATOR_API_KEY_FILE
    delete process.env.REVELATOR_API_KEY
    delete process.env.REVELATOR_API_KEY_FILE

    const period = { year: 2026, month: 5 }
    const refs = [{ tahtiReleaseId: 'rel_1', revelatorId: 'stub-rel_1' }]

    const rows = await fetchRoyaltyReports(refs, period)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      tahtiReleaseId: 'rel_1',
      revelatorId: 'stub-rel_1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      currency: 'EUR',
    })
    expect(rows[0].amountCents).toBeGreaterThanOrEqual(50)
    expect(rows[0].streams).toBeGreaterThanOrEqual(10)

    const again = await fetchRoyaltyReports(refs, period)
    expect(again[0].amountCents).toBe(rows[0].amountCents)

    if (prev) process.env.REVELATOR_API_KEY = prev
    else delete process.env.REVELATOR_API_KEY
    if (prevFile) process.env.REVELATOR_API_KEY_FILE = prevFile
    else delete process.env.REVELATOR_API_KEY_FILE
  })

  it('uses month boundaries for the requested period', async () => {
    const prev = process.env.REVELATOR_API_KEY
    const prevFile = process.env.REVELATOR_API_KEY_FILE
    delete process.env.REVELATOR_API_KEY
    delete process.env.REVELATOR_API_KEY_FILE

    const rows = await fetchRoyaltyReports(
      [{ tahtiReleaseId: 'rel_1', revelatorId: 'stub-rel_1' }],
      { year: 2026, month: 2 },
    )
    expect(rows[0].periodStart).toBe('2026-02-01')
    expect(rows[0].periodEnd).toBe('2026-02-28')

    if (prev) process.env.REVELATOR_API_KEY = prev
    else delete process.env.REVELATOR_API_KEY
    if (prevFile) process.env.REVELATOR_API_KEY_FILE = prevFile
    else delete process.env.REVELATOR_API_KEY_FILE
  })

  it('returns empty array when no releases', async () => {
    const rows = await fetchRoyaltyReports([], { year: 2026, month: 1 })
    expect(rows).toEqual([])
  })
})

describe('isRevelatorConfigured', () => {
  const prevKey = process.env.REVELATOR_API_KEY
  const prevFile = process.env.REVELATOR_API_KEY_FILE

  afterEach(() => {
    if (prevKey) process.env.REVELATOR_API_KEY = prevKey
    else delete process.env.REVELATOR_API_KEY
    if (prevFile) process.env.REVELATOR_API_KEY_FILE = prevFile
    else delete process.env.REVELATOR_API_KEY_FILE
  })

  it('reads API key from REVELATOR_API_KEY_FILE', () => {
    delete process.env.REVELATOR_API_KEY
    const dir = mkdtempSync(join(tmpdir(), 'revelator-key-'))
    const path = join(dir, 'key')
    writeFileSync(path, 'live-key\n')
    process.env.REVELATOR_API_KEY_FILE = path
    expect(isRevelatorConfigured()).toBe(true)
  })
})
