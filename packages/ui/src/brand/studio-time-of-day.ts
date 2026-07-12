// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Local-time bucket for studio ambient background (sun / moon / dawn / dusk). */
export type StudioTimeOfDay = 'day' | 'night' | 'dawn' | 'dusk'

/** Hour in [0, 23] — pass `Date.getHours()` in the viewer's local timezone. */
export function studioTimeOfDayFromHour(hour: number): StudioTimeOfDay {
  if (hour >= 21 || hour < 6) return 'night'
  if (hour < 8) return 'dawn'
  if (hour < 18) return 'day'
  return 'dusk'
}

export function studioTimeOfDayFromDate(date = new Date()): StudioTimeOfDay {
  return studioTimeOfDayFromHour(date.getHours())
}
