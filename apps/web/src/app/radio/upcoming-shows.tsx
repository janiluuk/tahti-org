'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { AvatarTile } from '@tahti/ui'
import type { PublicRadioSlot } from './actions'

const MAX_SHOWN = 6
const MAX_ROTATION_SHOWN = 5

export interface RotationQueueItem {
  id: string
  title: string
  artistName: string
  artistUsername: string | null
}

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

/** Radio page "Upcoming" tab — booked artist slots (the live one, if any,
 * highlighted first) plus a preview of the curated rotation's queue. Distinct
 * from the dense 7-day calendar in the "Schedule & rotation" overlay, which
 * stays around for anyone who wants the full grid. */
export function UpcomingShows({
  slots,
  rotation,
}: {
  slots: PublicRadioSlot[]
  rotation: RotationQueueItem[]
}) {
  const now = Date.now()
  const live = slots.filter(
    (s) => new Date(s.startAt).getTime() <= now && new Date(s.endAt).getTime() > now,
  )
  const upcoming = [...slots]
    .filter((s) => new Date(s.startAt).getTime() > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, MAX_SHOWN)
  const rotationQueue = rotation.slice(0, MAX_ROTATION_SHOWN)

  if (live.length === 0 && upcoming.length === 0 && rotationQueue.length === 0) return null

  return (
    <section className="ch-radio-upcoming">
      <h2 className="ch-radio-upcoming__title">Upcoming</h2>
      {(live.length > 0 || upcoming.length > 0) && (
        <ul className="ch-radio-upcoming__list">
          {live.map((slot) => (
            <li key={slot.id} className="ch-radio-upcoming__item ch-radio-upcoming__item--live">
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
              <span className="ch-radio-upcoming__live-badge">🔴 Live now</span>
            </li>
          ))}
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
      )}
      {rotationQueue.length > 0 && (
        <div className="ch-radio-upcoming__rotation">
          <div className="ch-radio-upcoming__rotation-label">Up next in the rotation</div>
          <ul className="ch-radio-upcoming__list">
            {rotationQueue.map((item) => (
              <li key={item.id} className="ch-radio-upcoming__item">
                <div className="ch-radio-upcoming__body">
                  <span className="ch-radio-upcoming__song">{item.title}</span>
                  {item.artistUsername ? (
                    <Link
                      href={`/u/${item.artistUsername}`}
                      className="ch-radio-upcoming__artist ch-radio-upcoming__artist--sub"
                    >
                      {item.artistName}
                    </Link>
                  ) : (
                    <span className="ch-radio-upcoming__artist ch-radio-upcoming__artist--sub">
                      {item.artistName}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
