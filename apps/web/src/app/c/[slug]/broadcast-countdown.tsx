// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'

interface TimeLeft {
  days: number
  hrs: number
  min: number
  sec: number
  past: boolean
}

function calcTimeLeft(target: Date): TimeLeft {
  const diff = target.getTime() - Date.now()
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
}: {
  targetIso: string
  note?: string | null
}) {
  const target = new Date(targetIso)
  const [t, setT] = useState<TimeLeft>(() => calcTimeLeft(target))

  useEffect(() => {
    const id = setInterval(() => setT(calcTimeLeft(target)), 1000)
    return () => clearInterval(id)
  }, [targetIso]) // eslint-disable-line react-hooks/exhaustive-deps

  if (t.past) return null

  return (
    <div className="ch-countdown">
      <p className="ch-countdown-label">Next live broadcast</p>
      {note && <p className="ch-countdown-note">{note}</p>}
      <div className="ch-countdown-tiles">
        <div className="ch-countdown-tile">
          <span className="ch-countdown-num">{String(t.days).padStart(2, '0')}</span>
          <span className="ch-countdown-unit">Days</span>
        </div>
        <div className="ch-countdown-tile">
          <span className="ch-countdown-num">{String(t.hrs).padStart(2, '0')}</span>
          <span className="ch-countdown-unit">Hrs</span>
        </div>
        <div className="ch-countdown-tile">
          <span className="ch-countdown-num">{String(t.min).padStart(2, '0')}</span>
          <span className="ch-countdown-unit">Min</span>
        </div>
        <div className="ch-countdown-tile">
          <span className="ch-countdown-num">{String(t.sec).padStart(2, '0')}</span>
          <span className="ch-countdown-unit">Sec</span>
        </div>
      </div>
    </div>
  )
}
