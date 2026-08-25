'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useMemo } from 'react'
import Link from 'next/link'
import { AvatarTile } from '@tahti/ui'
import type { PublicRadioSlot } from './actions'

const PAST_DAYS_SHOWN = 2
const FUTURE_DAYS_SHOWN = 4

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function dayLabel(d: Date, today: Date): string {
  const diffDays = Math.round((startOfDay(d).getTime() - startOfDay(today).getTime()) / 86_400_000)
  const dateBit = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  if (diffDays === 0) return `Today · ${dateBit}`
  if (diffDays === 1) return `Tomorrow · ${dateBit}`
  if (diffDays === -1) return `Yesterday · ${dateBit}`
  return `${d.toLocaleDateString(undefined, { weekday: 'long' })} · ${dateBit}`
}

function timeRange(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  return `${new Date(startIso).toLocaleTimeString(undefined, opts)}–${new Date(endIso).toLocaleTimeString(undefined, opts)}`
}

/** Tiger-striped, all-at-once schedule — a couple of past days plus the next
 * four, stacked as day-header groups with their booked slots underneath,
 * instead of one day-tab you had to click through at a time. Replaces both
 * the original 7×24 hour grid and the later click-through day-tabs — every
 * slot is visible in a single scroll, and a past one is still clickable
 * through to its show page, which links the recording once the artist has
 * published it (or just says when to catch the artist next). */
export function RadioScheduleList({ slots }: { slots: PublicRadioSlot[] }) {
  const today = useMemo(() => new Date(), [])
  const days = useMemo(
    () =>
      Array.from({ length: PAST_DAYS_SHOWN + FUTURE_DAYS_SHOWN }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() + i - PAST_DAYS_SHOWN)
        return d
      }),
    [today],
  )
  const now = Date.now()

  const dayGroups = useMemo(
    () =>
      days.map((d) => {
        const dayStart = startOfDay(d).getTime()
        const dayEnd = dayStart + 86_400_000
        const daySlots = [...slots]
          .filter((s) => {
            const t = new Date(s.startAt).getTime()
            return t >= dayStart && t < dayEnd
          })
          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
        return { day: d, slots: daySlots }
      }),
    [days, slots],
  )

  return (
    <div className="ch-radio-schedule">
      {dayGroups.map(({ day, slots: daySlots }) => {
        const isPastDay = startOfDay(day).getTime() < startOfDay(today).getTime()
        return (
          <section key={day.toISOString()} className="ch-radio-schedule__day-group">
            <h3 className="ch-radio-schedule__day-heading">{dayLabel(day, today)}</h3>
            {daySlots.length === 0 ? (
              <p className="ch-radio-schedule__empty">
                {isPastDay ? 'Nothing aired.' : 'Nothing booked yet.'}
              </p>
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
                      <span className="ch-radio-upcoming__time ch-radio-schedule__slot-time">
                        {timeRange(slot.startAt, slot.endAt)}
                      </span>
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
                      {isLive && <span className="ch-radio-upcoming__live-badge">🔴 Live now</span>}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
