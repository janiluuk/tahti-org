// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { studioTimeOfDayFromHour } from './studio-time-of-day.js'

describe('studioTimeOfDayFromHour', () => {
  it('marks night hours', () => {
    expect(studioTimeOfDayFromHour(0)).toBe('night')
    expect(studioTimeOfDayFromHour(22)).toBe('night')
  })

  it('marks daytime hours', () => {
    expect(studioTimeOfDayFromHour(8)).toBe('day')
    expect(studioTimeOfDayFromHour(17)).toBe('day')
  })

  it('marks dawn hours', () => {
    expect(studioTimeOfDayFromHour(6)).toBe('dawn')
    expect(studioTimeOfDayFromHour(7)).toBe('dawn')
  })

  it('marks dusk hours', () => {
    expect(studioTimeOfDayFromHour(18)).toBe('dusk')
    expect(studioTimeOfDayFromHour(20)).toBe('dusk')
  })

  it('marks boundary hours correctly', () => {
    expect(studioTimeOfDayFromHour(5)).toBe('night')
    expect(studioTimeOfDayFromHour(8)).toBe('day')
    expect(studioTimeOfDayFromHour(17)).toBe('day')
    expect(studioTimeOfDayFromHour(21)).toBe('night')
  })
})
