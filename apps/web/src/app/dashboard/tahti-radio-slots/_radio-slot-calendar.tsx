// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { Fragment, useEffect, useMemo, useState, useTransition } from 'react'
import { Button } from '@tahti/ui'
import { RADIO_SLOT_MAX_HOURS, type RadioSlotBookingItem } from '@tahti/shared'
import { cancelRadioSlotBooking, createRadioSlotBooking, listRadioSlotBookings } from './actions'

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

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

type Selection = { day: Date; startHour: number; hours: 1 | 2 }

export function RadioSlotCalendar({
  initialBookings,
}: {
  initialBookings: RadioSlotBookingItem[]
}) {
  const [weekStart, setWeekStart] = useState(() => startOfLocalDay(new Date()))
  const [bookings, setBookings] = useState(initialBookings)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const days = useMemo(
    () => Array.from({ length: DAYS_VISIBLE }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  useEffect(() => {
    setSelection(null)
    setError(null)
    setMessage(null)
    const from = weekStart.toISOString()
    const to = addDays(weekStart, DAYS_VISIBLE).toISOString()
    let cancelled = false
    void listRadioSlotBookings(from, to).then((res) => {
      if (cancelled) return
      if (res.error) setError(res.error)
      setBookings(res.bookings)
    })
    return () => {
      cancelled = true
    }
  }, [weekStart])

  function bookingAt(day: Date, hour: number): RadioSlotBookingItem | undefined {
    const cellStart = atHour(day, hour).getTime()
    return bookings.find((b) => {
      const s = new Date(b.startAt).getTime()
      const e = new Date(b.endAt).getTime()
      return cellStart >= s && cellStart < e
    })
  }

  function cancelBooking(id: string) {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const res = await cancelRadioSlotBooking(id)
      if (res.error) {
        setError(res.error)
        return
      }
      setBookings((prev) => prev.filter((b) => b.id !== id))
      setMessage('Booking cancelled.')
    })
  }

  function onCellClick(day: Date, hour: number) {
    const existing = bookingAt(day, hour)
    if (existing) {
      if (existing.isMine) cancelBooking(existing.id)
      return
    }

    const cellStart = atHour(day, hour)
    if (cellStart.getTime() <= Date.now()) return

    setError(null)
    setMessage(null)

    if (
      selection &&
      sameDay(selection.day, day) &&
      hour === selection.startHour + selection.hours &&
      selection.hours < RADIO_SLOT_MAX_HOURS
    ) {
      setSelection({ ...selection, hours: (selection.hours + 1) as 1 | 2 })
      return
    }
    if (selection && sameDay(selection.day, day) && hour === selection.startHour) {
      setSelection(null)
      return
    }
    setSelection({ day, startHour: hour, hours: 1 })
  }

  function extendSelection() {
    if (!selection || selection.hours >= RADIO_SLOT_MAX_HOURS) return
    const nextHour = selection.startHour + selection.hours
    if (nextHour > 23 || bookingAt(selection.day, nextHour)) return
    setSelection({ ...selection, hours: (selection.hours + 1) as 1 | 2 })
  }

  function confirmBooking() {
    if (!selection) return
    const startAt = atHour(selection.day, selection.startHour)
    const endAt = atHour(selection.day, selection.startHour + selection.hours)
    setError(null)
    startTransition(async () => {
      const res = await createRadioSlotBooking({
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        note: note.trim() || undefined,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.booking) setBookings((prev) => [...prev, res.booking!])
      setSelection(null)
      setNote('')
      setMessage('Slot booked.')
    })
  }

  const weekLabel = `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${days[
    DAYS_VISIBLE - 1
  ].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`

  return (
    <div className="studio-radio-calendar">
      <div className="studio-radio-calendar__nav">
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => setWeekStart((w) => addDays(w, -DAYS_VISIBLE))}
        >
          ← Previous week
        </Button>
        <span className="studio-radio-calendar__week-label">{weekLabel}</span>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => setWeekStart((w) => addDays(w, DAYS_VISIBLE))}
        >
          Next week →
        </Button>
      </div>

      <div className="studio-radio-calendar__scroll">
        <div className="studio-radio-calendar__grid">
          <div className="studio-radio-calendar__corner" />
          {days.map((day) => (
            <div key={day.toISOString()} className="studio-radio-calendar__day-header">
              <span>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span>
              <span className="studio-text-muted-sm">
                {day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}

          {HOURS.map((hour) => (
            <Fragment key={hour}>
              <div className="studio-radio-calendar__hour-label">
                {String(hour).padStart(2, '0')}:00
              </div>
              {days.map((day) => {
                const cellStart = atHour(day, hour)
                const isPast = cellStart.getTime() <= Date.now()
                const booking = bookingAt(day, hour)
                const isSelected = Boolean(
                  selection &&
                  sameDay(selection.day, day) &&
                  hour >= selection.startHour &&
                  hour < selection.startHour + selection.hours,
                )

                let className = 'studio-radio-calendar__cell'
                if (booking) {
                  className += booking.isMine
                    ? ' studio-radio-calendar__cell--mine'
                    : ' studio-radio-calendar__cell--busy'
                } else if (isPast) {
                  className += ' studio-radio-calendar__cell--past'
                } else {
                  className += ' studio-radio-calendar__cell--free'
                }
                if (isSelected) className += ' studio-radio-calendar__cell--selected'

                return (
                  <button
                    key={`${day.toISOString()}-${hour}`}
                    type="button"
                    className={className}
                    disabled={(isPast && !booking?.isMine) || pending}
                    onClick={() => onCellClick(day, hour)}
                    title={
                      booking
                        ? `${booking.displayName}${booking.note ? ` — ${booking.note}` : ''}${booking.isMine ? ' (click to cancel)' : ''}`
                        : undefined
                    }
                  >
                    {booking && (
                      <span className="studio-radio-calendar__cell-label">
                        {booking.displayName}
                      </span>
                    )}
                  </button>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {selection && (
        <div className="studio-radio-calendar__actionbar">
          <div>
            <strong>
              {selection.day.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
              {', '}
              {String(selection.startHour).padStart(2, '0')}:00–
              {String(selection.startHour + selection.hours).padStart(2, '0')}:00
            </strong>
            <span className="studio-text-muted-sm"> ({selection.hours}h)</span>
          </div>
          {selection.hours < RADIO_SLOT_MAX_HOURS && (
            <Button variant="secondary" size="sm" onClick={extendSelection} disabled={pending}>
              +1 hour
            </Button>
          )}
          <input
            type="text"
            className="studio-input studio-input--sm studio-flex-1"
            placeholder="Note (optional) — what you're playing"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button variant="primary" size="sm" onClick={confirmBooking} disabled={pending}>
            {pending ? 'Booking…' : 'Confirm booking'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelection(null)} disabled={pending}>
            Cancel
          </Button>
        </div>
      )}

      {message && <p className="studio-notice studio-notice--success studio-mt-sm">{message}</p>}
      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}

      <div className="studio-radio-calendar__legend">
        <span className="studio-radio-calendar__legend-item">
          <i className="studio-radio-calendar__legend-swatch studio-radio-calendar__legend-swatch--mine" />
          Your bookings (click to cancel)
        </span>
        <span className="studio-radio-calendar__legend-item">
          <i className="studio-radio-calendar__legend-swatch studio-radio-calendar__legend-swatch--busy" />
          Booked by others
        </span>
      </div>
    </div>
  )
}
