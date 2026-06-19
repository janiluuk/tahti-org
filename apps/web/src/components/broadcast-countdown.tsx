// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'

export interface TimeLeft {
  days: number
  hrs: number
  min: number
  sec: number
  past: boolean
}

export function calcTimeLeft(target: Date, now = Date.now()): TimeLeft {
  const diff = target.getTime() - now
  if (diff <= 0) return { days: 0, hrs: 0, min: 0, sec: 0, past: true }
  const totalSec = Math.floor(diff / 1000)
  const days = Math.floor(totalSec / 86400)
  const hrs = Math.floor((totalSec % 86400) / 3600)
  const min = Math.floor((totalSec % 3600) / 60)
  const sec = totalSec % 60
  return { days, hrs, min, sec, past: false }
}

export function BroadcastCountdown({
  targetIso,
  note,
  variant = 'channel',
}: {
  targetIso: string
  note?: string | null
  variant?: 'channel' | 'studio-compact'
}) {
  const target = new Date(targetIso)
  const [t, setT] = useState<TimeLeft>(() => calcTimeLeft(target))

  useEffect(() => {
    const id = setInterval(() => setT(calcTimeLeft(target)), 1000)
    return () => clearInterval(id)
  }, [targetIso]) // eslint-disable-line react-hooks/exhaustive-deps

  if (t.past) return null

  const isStudio = variant === 'studio-compact'
  const rootClass = isStudio ? 'studio-countdown-preview' : 'ch-countdown'
  const labelClass = isStudio ? 'studio-countdown-preview__label' : 'ch-countdown-label'
  const noteClass = isStudio ? 'studio-countdown-preview__note' : 'ch-countdown-note'
  const tilesClass = isStudio ? 'studio-countdown-preview__tiles' : 'ch-countdown-tiles'
  const tileClass = isStudio ? 'studio-countdown-preview__tile' : 'ch-countdown-tile'
  const numClass = isStudio ? 'studio-countdown-preview__num' : 'ch-countdown-num'
  const unitClass = isStudio ? 'studio-countdown-preview__unit' : 'ch-countdown-unit'

  return (
    <div className={rootClass} role="timer" aria-live="polite">
      <p className={labelClass}>Next live broadcast</p>
      {note && <p className={noteClass}>{note}</p>}
      <div className={tilesClass}>
        <div className={tileClass}>
          <span className={numClass}>{String(t.days).padStart(2, '0')}</span>
          <span className={unitClass}>Days</span>
        </div>
        <div className={tileClass}>
          <span className={numClass}>{String(t.hrs).padStart(2, '0')}</span>
          <span className={unitClass}>Hrs</span>
        </div>
        <div className={tileClass}>
          <span className={numClass}>{String(t.min).padStart(2, '0')}</span>
          <span className={unitClass}>Min</span>
        </div>
        <div className={tileClass}>
          <span className={numClass}>{String(t.sec).padStart(2, '0')}</span>
          <span className={unitClass}>Sec</span>
        </div>
      </div>
    </div>
  )
}
