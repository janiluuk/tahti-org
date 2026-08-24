'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'

export type UpcomingShowInfo = {
  source: 'radio' | 'own'
  title: string
  startAt: string
}

function IconClock() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 4.5V8l2.6 1.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatWhen(startAt: string): string {
  const diffMin = Math.round((new Date(startAt).getTime() - Date.now()) / 60_000)
  if (diffMin <= 0) return 'now'
  if (diffMin < 60) return `in ${diffMin}m`
  const diffHr = diffMin / 60
  if (diffHr < 24) return `in ${Math.round(diffHr)}h`
  return new Date(startAt).toLocaleDateString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Top-nav notice for a booked-but-not-yet-live show — either a Tahti Radio
 * slot or an episode on the artist's own channel schedule, whichever is
 * soonest (picked server-side by fetchNextUpcomingShow). Purely informational
 * — links through to wherever that booking is managed. */
export function UpcomingShowNotice({ show }: { show: UpcomingShowInfo }) {
  const href = show.source === 'radio' ? '/dashboard/tahti-radio-slots' : '/dashboard/schedule'
  return (
    <Link
      href={href}
      className="studio-top-nav__upcoming"
      title={`${show.title} — ${new Date(show.startAt).toLocaleString()}`}
    >
      <IconClock />
      <span className="studio-top-nav__upcoming-source">
        {show.source === 'radio' ? 'Tahti Radio' : 'Your channel'}
      </span>
      <span className="studio-top-nav__upcoming-title">{show.title}</span>
      <span className="studio-top-nav__upcoming-when">{formatWhen(show.startAt)}</span>
    </Link>
  )
}
