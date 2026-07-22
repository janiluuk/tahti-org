// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AvatarTile } from '@tahti/ui'
import { listPublicRadioSlots, type PublicRadioSlot } from './actions'

const DAYS_VISIBLE = 7
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function startOfLocalDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

function atHour(day: Date, hour: number): Date {
  const copy = new Date(day)
  copy.setHours(hour, 0, 0, 0)
  return copy
}

const BOOK_SLOT_PATH = '/dashboard/tahti-radio-slots'

export function RadioSlotsCalendar({
  initialSlots,
  isLoggedIn,
}: {
  initialSlots: PublicRadioSlot[]
  isLoggedIn: boolean
}) {
  const [weekStart, setWeekStart] = useState(() => startOfLocalDay(new Date()))
  const [slots, setSlots] = useState(initialSlots)
  const [selected, setSelected] = useState<PublicRadioSlot | null>(null)

  const days = useMemo(
    () => Array.from({ length: DAYS_VISIBLE }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  useEffect(() => {
    setSelected(null)
    const from = weekStart.toISOString()
    const to = addDays(weekStart, DAYS_VISIBLE).toISOString()
    let cancelled = false
    void listPublicRadioSlots(from, to).then((res) => {
      if (!cancelled) setSlots(res.slots)
    })
    return () => {
      cancelled = true
    }
  }, [weekStart])

  function slotAt(day: Date, hour: number): PublicRadioSlot | undefined {
    const cellStart = atHour(day, hour).getTime()
    return slots.find((s) => {
      const start = new Date(s.startAt).getTime()
      const end = new Date(s.endAt).getTime()
      return cellStart >= start && cellStart < end
    })
  }

  const weekLabel = `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${days[
    DAYS_VISIBLE - 1
  ].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`

  return (
    <section className="ch-radio-slots">
      <div className="ch-radio-slots__header">
        <span className="ch-radio-rotation__label">Live artist slots</span>
        <div className="ch-radio-slots__nav">
          <button
            type="button"
            className="ch-radio-slots__nav-btn"
            onClick={() => setWeekStart((w) => addDays(w, -DAYS_VISIBLE))}
          >
            ←
          </button>
          <span className="ch-radio-slots__week-label">{weekLabel}</span>
          <button
            type="button"
            className="ch-radio-slots__nav-btn"
            onClick={() => setWeekStart((w) => addDays(w, DAYS_VISIBLE))}
          >
            →
          </button>
        </div>
        <a
          href={isLoggedIn ? BOOK_SLOT_PATH : `/login?next=${encodeURIComponent(BOOK_SLOT_PATH)}`}
          className="ch-radio-slots__book-link"
        >
          {isLoggedIn ? 'Book a slot →' : 'Sign in to book a slot →'}
        </a>
      </div>

      <p className="ch-radio-slots__scroll-hint">Swipe sideways to see all 7 days →</p>
      <div className="ch-radio-slots__scroll">
        <div className="ch-radio-slots__grid">
          <div className="ch-radio-slots__corner" />
          {days.map((day) => (
            <div key={day.toISOString()} className="ch-radio-slots__day-header">
              <span>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span>
              <span className="ch-radio-slots__day-date">
                {day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}

          {HOURS.map((hour) => (
            <Fragment key={hour}>
              <div className="ch-radio-slots__hour-label">{String(hour).padStart(2, '0')}:00</div>
              {days.map((day) => {
                const slot = slotAt(day, hour)
                return (
                  <button
                    key={`${day.toISOString()}-${hour}`}
                    type="button"
                    className={`ch-radio-slots__cell${slot ? ' ch-radio-slots__cell--booked' : ''}`}
                    disabled={!slot}
                    onClick={() => slot && setSelected(slot)}
                    title={slot ? slot.artist.displayName : undefined}
                  >
                    {slot && (
                      <span className="ch-radio-slots__cell-label">{slot.artist.displayName}</span>
                    )}
                  </button>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {selected && (
        <div
          className="ch-radio-slots__popover-overlay"
          role="button"
          tabIndex={0}
          aria-label="Close"
          onClick={() => setSelected(null)}
          onKeyDown={(e) => e.key === 'Escape' && setSelected(null)}
        >
          <div className="ch-radio-slots__popover" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ch-radio-slots__popover-close"
              aria-label="Close"
              onClick={() => setSelected(null)}
            >
              ✕
            </button>
            <AvatarTile
              size="sm"
              name={selected.artist.displayName}
              src={selected.artist.avatarUrl ?? undefined}
            />
            <div className="ch-radio-slots__popover-name">{selected.artist.displayName}</div>
            <div className="ch-radio-slots__popover-time">
              {new Date(selected.startAt).toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' – '}
              {new Date(selected.endAt).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            {selected.note && <p className="ch-radio-slots__popover-note">{selected.note}</p>}
            <Link href={`/u/${selected.artist.username}`} className="ch-radio-slots__popover-link">
              View artist page →
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
