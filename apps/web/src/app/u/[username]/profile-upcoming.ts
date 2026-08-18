// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const DAY_MS = 86_400_000

export function humanizeFutureDate(date: Date, now = new Date()): string {
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const days = Math.max(0, Math.round((dateStart - nowStart) / DAY_MS))
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 14) return `in ${days} days`
  if (days < 60) {
    const weeks = Math.round(days / 7)
    return `in ${weeks} week${weeks === 1 ? '' : 's'}`
  }
  if (days < 548) {
    const months = Math.round(days / 30.44)
    return `in ${months} month${months === 1 ? '' : 's'}`
  }
  const years = Math.round(days / 365.25)
  return `in ${years} year${years === 1 ? '' : 's'}`
}
