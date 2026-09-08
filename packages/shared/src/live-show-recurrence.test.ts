// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  filterNonOverlappingOccurrences,
  scheduledShowEndAt,
  seriesShowDurationMin,
  timeRangesOverlap,
} from './live-show-recurrence.js'

describe('scheduledShowEndAt', () => {
  it('adds duration minutes', () => {
    const start = new Date('2026-09-08T18:00:00.000Z')
    expect(scheduledShowEndAt(start, 90)?.toISOString()).toBe('2026-09-08T19:30:00.000Z')
  })

  it('returns null for missing/invalid duration', () => {
    const start = new Date('2026-09-08T18:00:00.000Z')
    expect(scheduledShowEndAt(start, null)).toBeNull()
    expect(scheduledShowEndAt(start, 0)).toBeNull()
  })
})

describe('seriesShowDurationMin', () => {
  it('prefers recurrenceDurationMin over intervalHours', () => {
    expect(seriesShowDurationMin({ recurrenceDurationMin: 90, intervalHours: 1 })).toBe(90)
  })

  it('falls back to intervalHours', () => {
    expect(seriesShowDurationMin({ recurrenceDurationMin: null, intervalHours: 2 })).toBe(120)
  })
})

describe('timeRangesOverlap', () => {
  const t = (iso: string) => new Date(iso)

  it('detects overlapping windows', () => {
    expect(
      timeRangesOverlap(
        { startAt: t('2026-09-08T18:00:00Z'), endAt: t('2026-09-08T19:00:00Z') },
        { startAt: t('2026-09-08T18:30:00Z'), endAt: t('2026-09-08T19:30:00Z') },
      ),
    ).toBe(true)
  })

  it('allows back-to-back shows', () => {
    expect(
      timeRangesOverlap(
        { startAt: t('2026-09-08T18:00:00Z'), endAt: t('2026-09-08T19:00:00Z') },
        { startAt: t('2026-09-08T19:00:00Z'), endAt: t('2026-09-08T20:00:00Z') },
      ),
    ).toBe(false)
  })

  it('treats null end as a point', () => {
    expect(
      timeRangesOverlap(
        { startAt: t('2026-09-08T18:00:00Z'), endAt: null },
        { startAt: t('2026-09-08T18:00:00Z'), endAt: null },
      ),
    ).toBe(true)
    expect(
      timeRangesOverlap(
        { startAt: t('2026-09-08T18:00:00Z'), endAt: null },
        { startAt: t('2026-09-08T17:00:00Z'), endAt: t('2026-09-08T19:00:00Z') },
      ),
    ).toBe(true)
  })
})

describe('filterNonOverlappingOccurrences', () => {
  it('skips candidates that collide with existing shows', () => {
    const kept = filterNonOverlappingOccurrences(
      [
        new Date('2026-09-08T18:00:00Z'),
        new Date('2026-09-08T18:30:00Z'),
        new Date('2026-09-08T20:00:00Z'),
      ],
      60,
      [{ startAt: new Date('2026-09-08T18:00:00Z'), endAt: new Date('2026-09-08T19:00:00Z') }],
    )
    expect(kept.map((d) => d.toISOString())).toEqual(['2026-09-08T20:00:00.000Z'])
  })

  it('skips candidates that collide with each other', () => {
    const kept = filterNonOverlappingOccurrences(
      [new Date('2026-09-08T18:00:00Z'), new Date('2026-09-08T18:30:00Z')],
      60,
      [],
    )
    expect(kept.map((d) => d.toISOString())).toEqual(['2026-09-08T18:00:00.000Z'])
  })
})
