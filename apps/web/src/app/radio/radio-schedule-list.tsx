'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AvatarTile } from '@tahti/ui'
import type { PublicRadioSlot } from './actions'

const DAYS_SHOWN = 7

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function dayLabel(d: Date, today: Date): { top: string; bottom: string } {
  const diffDays = Math.round((startOfDay(d).getTime() - startOfDay(today).getTime()) / 86_400_000)
  const bottom = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  if (diffDays === 0) return { top: 'Today', bottom }
  if (diffDays === 1) return { top: 'Tomorrow', bottom }
  return { top: d.toLocaleDateString(undefined, { weekday: 'short' }), bottom }
}

function timeRange(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  return `${new Date(startIso).toLocaleTimeString(undefined, opts)}–${new Date(endIso).toLocaleTimeString(undefined, opts)}`
}

/** Clear, at-a-glance day-by-day schedule — a row of day tabs (Today, Tomorrow,
 * then weekday names) above a simple chronological list for the selected day.
 * Replaces the 7×24 grid calendar, which buried the handful of booked slots
 * in a mostly-empty hour grid. */
export function RadioScheduleList({ slots }: { slots: PublicRadioSlot[] }) {
  const today = useMemo(() => new Date(), [])
  const days = useMemo(
    () =>
      Array.from({ length: DAYS_SHOWN }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() + i)
        return d
      }),
    [today],
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const activeDay = days[activeIndex]!

  const dayStart = startOfDay(activeDay).getTime()
  const dayEnd = dayStart + 86_400_000
  const now = Date.now()

  const daySlots = useMemo(
    () =>
      [...slots]
        .filter((s) => {
          const t = new Date(s.startAt).getTime()
          return t >= dayStart && t < dayEnd
        })
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [slots, dayStart, dayEnd],
  )

  return (
    <div className="ch-radio-schedule">
      <div className="ch-radio-schedule__days" role="tablist" aria-label="Choose a day">
        {days.map((d, i) => {
          const label = dayLabel(d, today)
          return (
            <button
              key={d.toISOString()}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              className={`ch-radio-schedule__day${i === activeIndex ? ' ch-radio-schedule__day--active' : ''}`}
              onClick={() => setActiveIndex(i)}
            >
              <span className="ch-radio-schedule__day-top">{label.top}</span>
              <span className="ch-radio-schedule__day-bottom">{label.bottom}</span>
            </button>
          )
        })}
      </div>

      {daySlots.length === 0 ? (
        <p className="ch-radio-schedule__empty">Nothing booked for this day yet.</p>
      ) : (
        <ul className="ch-radio-upcoming__list">
          {daySlots.map((slot) => {
            const isLive =
              new Date(slot.startAt).getTime() <= now && new Date(slot.endAt).getTime() > now
            const showHref = slot.artist.channelSlug
              ? `/radio/show/${slot.artist.channelSlug}`
              : null
            const row = (
              <>
                <AvatarTile
                  size="sm"
                  name={slot.artist.displayName}
                  src={slot.artist.avatarUrl}
                  className="ch-radio-upcoming__avatar"
                />
                <div className="ch-radio-upcoming__body">
                  <span className="ch-radio-upcoming__artist">{slot.artist.displayName}</span>
                  {slot.note && <span className="ch-radio-upcoming__note">{slot.note}</span>}
                </div>
              </>
            )
            return (
              <li
                key={slot.id}
                className={`ch-radio-upcoming__item${isLive ? ' ch-radio-upcoming__item--live' : ''}`}
              >
                {showHref ? (
                  <Link href={showHref} className="ch-radio-upcoming__row-link">
                    {row}
                  </Link>
                ) : (
                  row
                )}
                {isLive ? (
                  <span className="ch-radio-upcoming__live-badge">🔴 Live now</span>
                ) : (
                  <span className="ch-radio-upcoming__time">
                    {timeRange(slot.startAt, slot.endAt)}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
