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

  it('marks twilight at dawn and dusk', () => {
    expect(studioTimeOfDayFromHour(6)).toBe('twilight')
    expect(studioTimeOfDayFromHour(19)).toBe('twilight')
  })
})
