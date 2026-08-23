// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { AvatarTile, Button, ButtonIcon } from '@tahti/ui'
import {
  RADIO_SLOT_MAX_HOURS,
  type BroadcastShowType,
  type RadioSlotBookingItem,
} from '@tahti/shared'
import { cancelRadioSlotBooking, createRadioSlotBooking, listRadioSlotBookings } from './actions'

/** Note doubles as a quasi-title when set (artists usually type what they're
 * playing/discussing there) — there's no dedicated title field on a booking. */
function bookingTitle(booking: RadioSlotBookingItem): string {
  return booking.note || (booking.showType === 'TALK' ? 'Talk show' : 'Live set')
}

function formatSlotRange(startAt: string, endAt: string): string {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const day = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const startTime = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const endTime = end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${day}, ${startTime}–${endTime}`
}

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
type HoverCard = { booking: RadioSlotBookingItem; top: number; left: number; openUpward: boolean }

export function RadioSlotCalendar({
  initialBookings,
}: {
  initialBookings: RadioSlotBookingItem[]
}) {
  const [weekStart, setWeekStart] = useState(() => startOfLocalDay(new Date()))
  const [bookings, setBookings] = useState(initialBookings)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [note, setNote] = useState('')
  const [showType, setShowType] = useState<BroadcastShowType>('LIVE_SET')
  const [hoverCard, setHoverCard] = useState<HoverCard | null>(null)
  const hideHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
    setHoverCard(null)
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

  useEffect(() => {
    return () => {
      if (hideHoverTimer.current) clearTimeout(hideHoverTimer.current)
    }
  }, [])

  // Precompute the day×hour → booking lookup once per bookings/days change instead
  // of re-scanning every booking for all 168 grid cells on every render (e.g. each
  // keystroke in the note field), while keeping the exact same match semantics.
  const bookingGrid = useMemo(() => {
    const map = new Map<string, RadioSlotBookingItem>()
    for (const day of days) {
      for (const hour of HOURS) {
        const cellStart = atHour(day, hour).getTime()
        const found = bookings.find((b) => {
          const s = new Date(b.startAt).getTime()
          const e = new Date(b.endAt).getTime()
          return cellStart >= s && cellStart < e
        })
        if (found) map.set(`${day.toDateString()}-${hour}`, found)
      }
    }
    return map
  }, [days, bookings])

  function bookingAt(day: Date, hour: number): RadioSlotBookingItem | undefined {
    return bookingGrid.get(`${day.toDateString()}-${hour}`)
  }

  // Fixed positioning (not absolute) so the card escapes .studio-radio-calendar__scroll's
  // overflow-x:auto clipping — same technique as GuidedTour's spotlight card.
  //
  // The hide is debounced (not immediate on mouseleave) so moving the pointer
  // from the cell to the card itself — to click "View channel" — doesn't close
  // it mid-transit; scheduleHideHoverCard is cancelled if the card itself picks
  // up a mouseenter before the timer fires.
  function showHoverCard(booking: RadioSlotBookingItem, target: HTMLElement) {
    if (hideHoverTimer.current) {
      clearTimeout(hideHoverTimer.current)
      hideHoverTimer.current = null
    }
    const rect = target.getBoundingClientRect()
    const openUpward = rect.top > window.innerHeight / 2
    setHoverCard({
      booking,
      left: Math.min(Math.max(rect.left, 12), window.innerWidth - 288),
      top: openUpward ? rect.top - 8 : rect.bottom + 8,
      openUpward,
    })
  }

  function scheduleHideHoverCard() {
    hideHoverTimer.current = setTimeout(() => setHoverCard(null), 150)
  }

  function cancelHideHoverCard() {
    if (hideHoverTimer.current) {
      clearTimeout(hideHoverTimer.current)
      hideHoverTimer.current = null
    }
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
        showType,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.booking) setBookings((prev) => [...prev, res.booking!])
      setSelection(null)
      setNote('')
      setShowType('LIVE_SET')
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
                    onMouseEnter={(e) => booking && showHoverCard(booking, e.currentTarget)}
                    onMouseLeave={scheduleHideHoverCard}
                    onFocus={(e) => booking && showHoverCard(booking, e.currentTarget)}
                    onBlur={scheduleHideHoverCard}
                    aria-label={
                      booking
                        ? `${bookingTitle(booking)} by ${booking.displayName}${booking.isMine ? ' — click to cancel' : ''}`
                        : undefined
                    }
                  >
                    {booking && (
                      <span className="studio-radio-calendar__cell-label">
                        <AvatarTile
                          size="xs"
                          name={booking.displayName}
                          src={booking.avatarUrl}
                          className="studio-radio-calendar__cell-avatar"
                        />
                        <span className="studio-radio-calendar__cell-text">
                          {booking.displayName}
                          {booking.showType === 'TALK' ? ' · Talk' : ''}
                        </span>
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
          <div
            className="studio-kind-toggle studio-kind-toggle--compact"
            role="radiogroup"
            aria-label="Show type"
          >
            <label
              className={`studio-kind-toggle__option${showType === 'LIVE_SET' ? ' studio-kind-toggle__option--active' : ''}`}
            >
              <input
                type="radio"
                name="slot-show-type"
                checked={showType === 'LIVE_SET'}
                onChange={() => setShowType('LIVE_SET')}
              />
              <span className="studio-kind-toggle__title">Live set</span>
            </label>
            <label
              className={`studio-kind-toggle__option${showType === 'TALK' ? ' studio-kind-toggle__option--active' : ''}`}
            >
              <input
                type="radio"
                name="slot-show-type"
                checked={showType === 'TALK'}
                onChange={() => setShowType('TALK')}
              />
              <span className="studio-kind-toggle__title">Talk</span>
            </label>
          </div>
          <input
            type="text"
            className="studio-input studio-input--sm studio-flex-1"
            placeholder={
              showType === 'TALK'
                ? 'Note (optional) — topic or guests'
                : "Note (optional) — what you're playing"
            }
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button variant="primary" size="sm" onClick={confirmBooking} disabled={pending}>
            <ButtonIcon name="check" />
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

      {hoverCard && (
        <div
          className={`studio-radio-calendar__hovercard${hoverCard.openUpward ? ' studio-radio-calendar__hovercard--up' : ''}`}
          style={{ top: hoverCard.top, left: hoverCard.left }}
          role="tooltip"
          onMouseEnter={cancelHideHoverCard}
          onMouseLeave={scheduleHideHoverCard}
        >
          <AvatarTile
            size="sm"
            name={hoverCard.booking.displayName}
            src={hoverCard.booking.avatarUrl}
            className="studio-radio-calendar__hovercard-avatar"
          />
          <div className="studio-radio-calendar__hovercard-body">
            <div className="studio-radio-calendar__hovercard-title">
              {bookingTitle(hoverCard.booking)}
            </div>
            <div className="studio-radio-calendar__hovercard-artist">
              {hoverCard.booking.displayName}
            </div>
            <div className="studio-radio-calendar__hovercard-time">
              {formatSlotRange(hoverCard.booking.startAt, hoverCard.booking.endAt)}
            </div>
            <Link
              href={`/c/${hoverCard.booking.channelSlug}`}
              className="studio-radio-calendar__hovercard-link"
            >
              View channel →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
