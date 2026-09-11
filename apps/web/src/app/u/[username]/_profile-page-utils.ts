// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Rounds to the single largest whole unit — "3 days" / "5 months" / "2 years" —
 * never a combined "X years, Y months" sentence. The precise month/year shows
 * on hover via joinDateTitle instead. */
export function relativeSince(date: Date, now: Date): string {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  if (days < 1) return 'today'
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30.44)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(days / 365.25)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

export function formatJoinDateLabel(joinDate: string | null | undefined): string | null {
  if (!joinDate) return null
  const date = new Date(joinDate)
  if (Number.isNaN(date.getTime())) return null
  return `Joined ${relativeSince(date, new Date())}`
}

export function formatJoinDateTitle(joinDate: string | null | undefined): string | undefined {
  if (!joinDate) return undefined
  const date = new Date(joinDate)
  if (Number.isNaN(date.getTime())) return undefined
  return `Joined ${date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
}
