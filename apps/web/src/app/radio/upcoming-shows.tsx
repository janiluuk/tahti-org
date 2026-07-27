'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { AvatarTile } from '@tahti/ui'
import type { PublicRadioSlot } from './actions'

const MAX_SHOWN = 6

function formatShowTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayDiff = Math.round((startOfDay.getTime() - startOfToday.getTime()) / 86_400_000)

  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (dayDiff === 0) return `Today, ${time}`
  if (dayDiff === 1) return `Tomorrow, ${time}`
  return `${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}, ${time}`
}

/** Radio page, below the player — only shows that haven't started yet (the
 * live one, if any, already has its own banner above the player). A quiet
 * always-visible list instead of the dense 7-day calendar in the "Schedule &
 * rotation" overlay, which stays around for anyone who wants the full grid. */
export function UpcomingShows({ slots }: { slots: PublicRadioSlot[] }) {
  const now = Date.now()
  const upcoming = [...slots]
    .filter((s) => new Date(s.startAt).getTime() > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, MAX_SHOWN)

  if (upcoming.length === 0) return null

  return (
    <section className="ch-radio-upcoming">
      <h2 className="ch-radio-upcoming__title">Upcoming shows</h2>
      <ul className="ch-radio-upcoming__list">
        {upcoming.map((slot) => (
          <li key={slot.id} className="ch-radio-upcoming__item">
            <AvatarTile
              size="sm"
              name={slot.artist.displayName}
              src={slot.artist.avatarUrl}
              className="ch-radio-upcoming__avatar"
            />
            <div className="ch-radio-upcoming__body">
              <Link href={`/u/${slot.artist.username}`} className="ch-radio-upcoming__artist">
                {slot.artist.displayName}
              </Link>
              {slot.note && <span className="ch-radio-upcoming__note">{slot.note}</span>}
            </div>
            <span className="ch-radio-upcoming__time">{formatShowTime(slot.startAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
