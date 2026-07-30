// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { AvatarTile } from '@tahti/ui'
import { listPublicRadioSlots, type PublicRadioSlot } from './actions'
import { formatShowTime } from './upcoming-shows'
import { resolveChannelUrl } from '@/lib/app-url'

const DAYS_VISIBLE = 7
const HOURS = Array.from({ length: 24 }, (_, i) => i)

// Fallback when the artist has no extracted avatar palette yet.
const SHOW_COLOR_VARS = ['--cyan', '--amber', '--green', '--purple', '--coral', '--cyan-200']

function showColorFallback(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return `var(${SHOW_COLOR_VARS[hash % SHOW_COLOR_VARS.length]!})`
}

function showAccent(slot: PublicRadioSlot): string {
  return (
    slot.colorScheme?.accent ?? showColorFallback(slot.artist.channelSlug ?? slot.artist.username)
  )
}

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

function formatDuration(startAt: string, endAt: string): string {
  const mins = Math.max(
    0,
    Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000),
  )
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function formatShowWindow(startAt: string, endAt: string): string {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const day = start.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const from = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const to = end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${day} · ${from} – ${to}`
}

function formatRelativeShow(iso: string | null, kind: 'next' | 'last'): string | null {
  if (!iso) return null
  const when = formatShowTime(iso)
  return kind === 'next' ? `Next: ${when}` : `Last: ${when}`
}

const BOOK_SLOT_PATH = '/dashboard/tahti-radio-slots'

function ShowDetailCard({ slot, onClose }: { slot: PublicRadioSlot; onClose: () => void }) {
  const now = Date.now()
  const start = new Date(slot.startAt).getTime()
  const end = new Date(slot.endAt).getTime()
  const isLive = now >= start && now < end
  const isUpcoming = now < start
  const channelHref = slot.artist.channelSlug
    ? resolveChannelUrl(slot.artist.channelSlug)
    : `/u/${slot.artist.username}`
  const showHref = slot.artist.channelSlug
    ? `/radio/show/${slot.artist.channelSlug}`
    : `/u/${slot.artist.username}`
  const accent = showAccent(slot)
  const heroUrl = slot.coverUrl || slot.artist.avatarUrl
  const nextLabel = formatRelativeShow(slot.nextShowAt, 'next')
  const lastLabel = formatRelativeShow(slot.lastShowAt, 'last')

  return (
    <div
      className="ch-radio-slots__show-card"
      style={
        {
          '--show-color': accent,
          ...(slot.colorScheme
            ? {
                '--show-bg': slot.colorScheme.bg,
                '--show-muted': slot.colorScheme.muted,
                '--show-highlight': slot.colorScheme.highlight,
              }
            : {}),
        } as CSSProperties
      }
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="ch-radio-slots__show-card-close"
        aria-label="Close"
        onClick={onClose}
      >
        ✕
      </button>

      <div
        className={`ch-radio-slots__show-card-hero${heroUrl ? ' ch-radio-slots__show-card-hero--image' : ''}`}
        style={heroUrl ? { backgroundImage: `url(${heroUrl})` } : undefined}
        aria-hidden
      >
        <div className="ch-radio-slots__show-card-glow" />
      </div>

      <div className="ch-radio-slots__show-card-body">
        <AvatarTile
          size="lg"
          name={slot.artist.displayName}
          src={slot.artist.avatarUrl ?? undefined}
          className="ch-radio-slots__show-card-avatar"
        />

        <div className="ch-radio-slots__show-card-meta">
          {isLive && <span className="ch-radio-slots__show-card-badge">On air now</span>}
          {isUpcoming && !isLive && (
            <span className="ch-radio-slots__show-card-badge ch-radio-slots__show-card-badge--soon">
              Upcoming · {formatShowTime(slot.startAt)}
            </span>
          )}
          {!isLive && !isUpcoming && (
            <span className="ch-radio-slots__show-card-badge ch-radio-slots__show-card-badge--past">
              Past show
            </span>
          )}

          <h2 className="ch-radio-slots__show-card-name">{slot.artist.displayName}</h2>
          <p className="ch-radio-slots__show-card-handle">@{slot.artist.username}</p>

          <p className="ch-radio-slots__show-card-when">
            {formatShowWindow(slot.startAt, slot.endAt)}
          </p>
          <p className="ch-radio-slots__show-card-duration">
            {formatDuration(slot.startAt, slot.endAt)} on Tahti Radio
          </p>

          {(nextLabel || lastLabel) && (
            <p className="ch-radio-slots__show-card-schedule">
              {nextLabel && <span>{nextLabel}</span>}
              {nextLabel && lastLabel && <span aria-hidden> · </span>}
              {lastLabel && <span>{lastLabel}</span>}
            </p>
          )}

          {slot.note ? (
            <p className="ch-radio-slots__show-card-note">{slot.note}</p>
          ) : (
            <p className="ch-radio-slots__show-card-note ch-radio-slots__show-card-note--muted">
              Live set on the community radio stream.
            </p>
          )}

          <div className="ch-radio-slots__show-card-actions">
            <Link
              href={showHref}
              className="ch-radio-slots__show-card-btn ch-radio-slots__show-card-btn--primary"
            >
              Show page
            </Link>
            <Link href={`/u/${slot.artist.username}`} className="ch-radio-slots__show-card-btn">
              Artist profile
            </Link>
            <Link href={channelHref} className="ch-radio-slots__show-card-btn">
              Channel
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  useEffect(() => {
    if (!selected) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelected(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selected])

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

  const detail =
    selected && mounted
      ? createPortal(
          <div
            className="ch-radio-slots__popover-overlay"
            role="presentation"
            onClick={() => setSelected(null)}
          >
            <ShowDetailCard slot={selected} onClose={() => setSelected(null)} />
          </div>,
          document.body,
        )
      : null

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
        <Link
          href={isLoggedIn ? BOOK_SLOT_PATH : `/login?next=${encodeURIComponent(BOOK_SLOT_PATH)}`}
          className="ch-radio-slots__book-link"
        >
          {isLoggedIn ? 'Book a slot →' : 'Sign in to book a slot →'}
        </Link>
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
                const accent = slot ? showAccent(slot) : null
                return (
                  <button
                    key={`${day.toISOString()}-${hour}`}
                    type="button"
                    className={`ch-radio-slots__cell${slot ? ' ch-radio-slots__cell--booked' : ''}${
                      selected?.id === slot?.id ? ' ch-radio-slots__cell--selected' : ''
                    }`}
                    disabled={!slot}
                    onClick={() => slot && setSelected(slot)}
                    title={slot ? slot.artist.displayName : undefined}
                    style={accent ? ({ '--show-color': accent } as CSSProperties) : undefined}
                  >
                    {slot && (
                      <span className="ch-radio-slots__cell-inner">
                        <AvatarTile
                          size="xs"
                          name={slot.artist.displayName}
                          src={slot.artist.avatarUrl ?? undefined}
                          className="ch-radio-slots__cell-avatar"
                        />
                        <span className="ch-radio-slots__cell-label">
                          {slot.artist.displayName}
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

      {detail}
    </section>
  )
}
