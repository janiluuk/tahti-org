// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Pure, dependency-free weekly-recurrence math for LiveShowSeries. Everything
// else on the schedule page stores a naive UTC instant (the browser converts
// a datetime-local input once, at input time) — that doesn't work for
// recurrence, where future occurrences have to be computed later, on the
// server/worker, with no browser involved. So recurrence additionally
// persists an IANA zone (captured client-side via
// Intl.DateTimeFormat().resolvedOptions().timeZone) and this module resolves
// "next Friday at 22:00 in Europe/Helsinki" to the correct UTC instant for
// that specific date, DST included, using the standard formatToParts
// round-trip trick instead of pulling in a timezone library.

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/

export interface RecurrenceRule {
  /** 0 = Sunday .. 6 = Saturday (JS Date#getDay convention). */
  days: number[]
  /** 24h "HH:mm", interpreted in `timezone`. */
  timeOfDay: string
  /** IANA zone, e.g. "Europe/Helsinki". */
  timezone: string
}

/** The civil (year, month, day) as seen in `timeZone` at instant `at`. */
function civilDateInZone(timeZone: string, at: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

/** Resolves a civil date + "HH:mm" in an IANA zone to the precise UTC instant,
 * correctly accounting for that date's DST offset (not just the zone's
 * *current* offset). Standard technique: guess the instant as if the wall
 * clock were UTC, read back what that instant actually shows in the target
 * zone, and correct by the difference — one iteration is exact because
 * `Intl` zone offsets don't depend on the guess itself. */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guessMs = Date.UTC(year, month - 1, day, hour, minute, 0)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(guessMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const readHour = get('hour') % 24 // Intl can format midnight as "24"
  const readAsUtcMs = Date.UTC(get('year'), get('month') - 1, get('day'), readHour, get('minute'))
  return new Date(guessMs + (guessMs - readAsUtcMs))
}

export function isValidRecurrenceRule(rule: {
  days: number[]
  timeOfDay: string | null
  timezone: string | null
}): rule is RecurrenceRule {
  return (
    rule.days.length > 0 &&
    rule.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    typeof rule.timeOfDay === 'string' &&
    HH_MM.test(rule.timeOfDay) &&
    typeof rule.timezone === 'string' &&
    rule.timezone.trim().length > 0
  )
}

/** Every future UTC instant within [now, now+horizonDays) that lands on one
 * of `rule.days` at `rule.timeOfDay` in `rule.timezone`. Strictly after
 * `now` — "today at a time that's already passed" is never returned. */
export function nextRecurrenceOccurrences(
  rule: RecurrenceRule,
  now: Date,
  horizonDays: number,
): Date[] {
  const [hh, mm] = rule.timeOfDay.split(':').map(Number)
  const dayFilter = new Set(rule.days)
  const start = civilDateInZone(rule.timezone, now)
  const startUtcMidnight = Date.UTC(start.year, start.month - 1, start.day)

  const occurrences: Date[] = []
  for (let i = 0; i < horizonDays; i++) {
    // Date.UTC normalizes day overflow (day 32 of March = 1 April), so this
    // walks real calendar dates one at a time without a Date-object detour.
    const dayMs = startUtcMidnight + i * 86_400_000
    const civil = new Date(dayMs)
    const weekday = civil.getUTCDay()
    if (!dayFilter.has(weekday)) continue
    const instant = zonedTimeToUtc(
      civil.getUTCFullYear(),
      civil.getUTCMonth() + 1,
      civil.getUTCDate(),
      hh!,
      mm!,
      rule.timezone,
    )
    if (instant > now) occurrences.push(instant)
  }
  return occurrences
}

export const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const
