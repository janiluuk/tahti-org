'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { AvatarTile } from '@tahti/ui'
import { BroadcastCountdown } from '@/components/broadcast-countdown'
import type { PublicRadioSlot } from './actions'

const MAX_SHOWN = 6
const MAX_ROTATION_SHOWN = 5

export interface RotationQueueItem {
  id: string
  title: string
  artistName: string
  artistUsername: string | null
}

export function formatShowTime(iso: string): string {
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
  nextLiveCountdown,
  embedded = false,
}: {
  slots: PublicRadioSlot[]
  rotation: RotationQueueItem[]
  /** Set when a booked slot starts soon enough to announce — rendered as this
   * tab's header (in place of the plain "Upcoming" title) instead of floating
   * above the player, since it's specifically about what's coming up next. */
  nextLiveCountdown?: { targetIso: string; note: string } | null
  /** Rendered inside RadioTabs' own card + tab-labeled panel — skip the
   * redundant outer card chrome (the active tab already says "Upcoming"). */
  embedded?: boolean
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

  if (
    live.length === 0 &&
    upcoming.length === 0 &&
    rotationQueue.length === 0 &&
    !nextLiveCountdown
  )
    return null

  const header = nextLiveCountdown ? (
    <BroadcastCountdown targetIso={nextLiveCountdown.targetIso} note={nextLiveCountdown.note} />
  ) : embedded ? null : (
    <h2 className="ch-radio-upcoming__title">Upcoming</h2>
  )

  const body = (
    <>
      {header}
      {(live.length > 0 || upcoming.length > 0) && (
        <ul className="ch-radio-upcoming__list">
          {live.map((slot) => {
            const showHref = slot.artist.channelSlug
              ? `/radio/show/${slot.artist.channelSlug}`
              : null
            return (
              <li key={slot.id} className="ch-radio-upcoming__item ch-radio-upcoming__item--live">
                {showHref ? (
                  <Link href={showHref} className="ch-radio-upcoming__row-link">
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
                  </Link>
                ) : (
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
                )}
                <span className="ch-radio-upcoming__live-badge">🔴 Live now</span>
              </li>
            )
          })}
          {upcoming.map((slot) => {
            const showHref = slot.artist.channelSlug
              ? `/radio/show/${slot.artist.channelSlug}`
              : null
            return (
              <li key={slot.id} className="ch-radio-upcoming__item">
                {showHref ? (
                  <Link href={showHref} className="ch-radio-upcoming__row-link">
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
                  </Link>
                ) : (
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
                )}
                <span className="ch-radio-upcoming__time">{formatShowTime(slot.startAt)}</span>
              </li>
            )
          })}
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
    </>
  )

  if (embedded) return body

  return <section className="ch-radio-upcoming">{body}</section>
}
