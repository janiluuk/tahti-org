'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useRef } from 'react'

/** Silence floor for the meter scale — anything quieter reads as 0%. */
const FLOOR_DBFS = -60

function dbfsFromTimeDomain(data: Uint8Array): number {
  let sumSquares = 0
  for (let i = 0; i < data.length; i++) {
    const sample = (data[i]! - 128) / 128
    sumSquares += sample * sample
  }
  const rms = Math.sqrt(sumSquares / data.length)
  if (rms <= 0) return FLOOR_DBFS
  return Math.max(FLOOR_DBFS, 20 * Math.log10(rms))
}

function dbfsToPercent(dbfs: number): number {
  return Math.min(100, Math.max(0, ((dbfs - FLOOR_DBFS) / -FLOOR_DBFS) * 100))
}

function ChannelMeter({
  analyser,
  label,
  active,
}: {
  analyser: AnalyserNode | null
  label: string
  active: boolean
}) {
  const fillRef = useRef<HTMLDivElement>(null)
  const peakLabelRef = useRef<HTMLDivElement>(null)
  const peakHoldRef = useRef({ dbfs: FLOOR_DBFS, heldAt: 0 })

  useEffect(() => {
    if (!analyser || !active) return
    let raf: number
    const data = new Uint8Array(analyser.fftSize)

    const tick = () => {
      analyser.getByteTimeDomainData(data)
      const dbfs = dbfsFromTimeDomain(data)
      const pct = dbfsToPercent(dbfs)

      const now = performance.now()
      const hold = peakHoldRef.current
      if (dbfs >= hold.dbfs || now - hold.heldAt > 1500) {
        hold.dbfs = dbfs
        hold.heldAt = now
      }

      if (fillRef.current) fillRef.current.style.width = `${pct}%`
      if (peakLabelRef.current) {
        peakLabelRef.current.textContent =
          hold.dbfs <= FLOOR_DBFS ? 'peak — silent' : `peak ${hold.dbfs.toFixed(1)} dBFS`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [analyser, active])

  return (
    <div className="signal-meter">
      <div className="studio-label studio-text-muted-sm signal-meter__label">{label}</div>
      <div className="signal-meter__bar">
        <div ref={fillRef} className="signal-meter__fill" style={{ width: '0%' }} />
      </div>
      <div ref={peakLabelRef} className="signal-meter__peak studio-font-mono">
        peak — silent
      </div>
    </div>
  )
}

/**
 * Stereo input-level meters for the broadcast test-signal step (docs/reference-html/
 * 04-broadcasting-step-2-test-signal.html). Reads the shared player's per-channel
 * analysers — active only while the studio preview is actually playing, since an
 * AnalyserNode reports silence (not "no data") when nothing is connected/playing.
 */
export function SignalMeters({
  analyserL,
  analyserR,
  active,
}: {
  analyserL: AnalyserNode | null
  analyserR: AnalyserNode | null
  active: boolean
}) {
  return (
    <div className="signal-meters">
      <ChannelMeter analyser={analyserL} label="Input level · L" active={active} />
      <ChannelMeter analyser={analyserR} label="Input level · R" active={active} />
    </div>
  )
}
