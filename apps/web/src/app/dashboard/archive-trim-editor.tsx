// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { bounceArchiveTrim, fetchArchiveEditorSource } from './archive-actions'

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function ArchiveTrimEditor({
  itemId,
  onBounced,
}: {
  itemId: string
  onBounced: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const regionRef = useRef<ReturnType<RegionsPlugin['addRegion']> | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [durationSec, setDurationSec] = useState(0)
  const [startSec, setStartSec] = useState(0)
  const [endSec, setEndSec] = useState(0)
  const [fadeInSec, setFadeInSec] = useState(0)
  const [fadeOutSec, setFadeOutSec] = useState(0)
  const [peakNormalize, setPeakNormalize] = useState(false)
  const [lufsTarget, setLufsTarget] = useState<'none' | 'stream' | 'club'>('none')
  const [limiterEnabled, setLimiterEnabled] = useState(false)
  const [highPassHz, setHighPassHz] = useState(0)
  const [lowPassHz, setLowPassHz] = useState(0)
  const [lowGainDb, setLowGainDb] = useState(0)
  const [midGainDb, setMidGainDb] = useState(0)
  const [highGainDb, setHighGainDb] = useState(0)
  const [compressorEnabled, setCompressorEnabled] = useState(false)
  const [versionLabel, setVersionLabel] = useState('')
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return

    let cancelled = false
    let ws: WaveSurfer | null = null

    async function init() {
      setLoading(true)
      setError(null)

      const source = await fetchArchiveEditorSource(itemId)
      if (cancelled) return
      if (source.error || !source.url) {
        setError(source.error ?? 'Could not load audio')
        setLoading(false)
        return
      }

      const container = containerRef.current
      if (!container) {
        setLoading(false)
        return
      }

      ws = WaveSurfer.create({
        container,
        height: 72,
        waveColor: 'rgba(148, 163, 184, 0.45)',
        progressColor: 'rgba(34, 211, 238, 0.85)',
        cursorColor: 'rgba(34, 211, 238, 1)',
        barWidth: 2,
        barGap: 1,
        normalize: true,
        url: source.url,
      })

      const regions = ws.registerPlugin(RegionsPlugin.create())
      wavesurferRef.current = ws

      ws.on('ready', () => {
        if (cancelled || !ws) return
        const dur = ws.getDuration()
        setDurationSec(dur)
        setEndSec(dur)
        const region = regions.addRegion({
          start: 0,
          end: dur,
          drag: true,
          resize: true,
          color: 'rgba(34, 211, 238, 0.18)',
        })
        regionRef.current = region
        region.on('update-end', () => {
          setStartSec(region.start)
          setEndSec(region.end)
        })
      })

      ws.on('error', () => {
        if (!cancelled) setError('Failed to decode audio')
      })

      setLoading(false)
    }

    void init()

    return () => {
      cancelled = true
      regionRef.current = null
      wavesurferRef.current?.destroy()
      wavesurferRef.current = null
    }
  }, [open, itemId])

  function playSelection() {
    const ws = wavesurferRef.current
    const region = regionRef.current
    if (!ws || !region) return
    ws.setTime(region.start)
    ws.play()
    const stopAt = region.end
    const onTime = (t: number) => {
      if (t >= stopAt) {
        ws.pause()
        ws.un('timeupdate', onTime)
      }
    }
    ws.on('timeupdate', onTime)
  }

  function bounce() {
    const label = versionLabel.trim()
    if (!label) {
      setError('Enter a version label for the trimmed bounce')
      return
    }
    if (endSec <= startSec) {
      setError('End must be after start')
      return
    }

    setError(null)
    startTransition(async () => {
      const res = await bounceArchiveTrim(itemId, {
        startSec,
        endSec,
        fadeInSec,
        fadeOutSec,
        peakNormalize,
        lufsTarget,
        limiterEnabled,
        highPassHz,
        lowPassHz,
        eq: { lowGainDb, midGainDb, highGainDb },
        compressorEnabled,
        versionLabel: label,
        activate: true,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setVersionLabel('')
      setOpen(false)
      onBounced()
    })
  }

  return (
    <div className="studio-trim-editor">
      <div className="studio-row studio-row--between studio-mb-sm">
        <h4 className="studio-text-strong-sm studio-m-0">Trim &amp; fade (v0)</h4>
        <button type="button" className="studio-btn-ghost" onClick={() => setOpen(!open)}>
          {open ? 'Close trimmer' : 'Open trimmer'}
        </button>
      </div>
      {!open ? (
        <p className="studio-text-muted-sm studio-m-0">
          Crop dead air, add fades, and save as a new archive version.
        </p>
      ) : (
        <>
          <div ref={containerRef} className="studio-trim-waveform" aria-hidden={loading} />
          {loading && <p className="studio-text-muted-sm">Loading waveform…</p>}

          {!loading && durationSec > 0 && (
            <>
              <p className="studio-text-muted-sm studio-m-0 studio-mb-md">
                Selection {formatSec(startSec)} – {formatSec(endSec)} (
                {formatSec(Math.max(0, endSec - startSec))})
              </p>

              <div className="studio-trim-controls">
                <label className="studio-field studio-field--inline">
                  <span className="studio-label">Fade in (s)</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.1}
                    value={fadeInSec}
                    onChange={(e) => setFadeInSec(Number(e.target.value))}
                    className="studio-input studio-input--narrow"
                    disabled={isPending}
                  />
                </label>
                <label className="studio-field studio-field--inline">
                  <span className="studio-label">Fade out (s)</span>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.1}
                    value={fadeOutSec}
                    onChange={(e) => setFadeOutSec(Number(e.target.value))}
                    className="studio-input studio-input--narrow"
                    disabled={isPending}
                  />
                </label>
                <label className="studio-field studio-field--inline">
                  <span className="studio-label">LUFS target</span>
                  <select
                    value={lufsTarget}
                    onChange={(e) => {
                      const v = e.target.value as 'none' | 'stream' | 'club'
                      setLufsTarget(v)
                      if (v !== 'none') setPeakNormalize(false)
                    }}
                    className="studio-input"
                    disabled={isPending}
                  >
                    <option value="none">None</option>
                    <option value="stream">−14 stream</option>
                    <option value="club">−9 club</option>
                  </select>
                </label>
                <label className="studio-checkbox-label">
                  <input
                    type="checkbox"
                    checked={peakNormalize}
                    onChange={(e) => {
                      setPeakNormalize(e.target.checked)
                      if (e.target.checked) setLufsTarget('none')
                    }}
                    disabled={isPending || lufsTarget !== 'none'}
                  />
                  Peak normalize
                </label>
                <label className="studio-checkbox-label">
                  <input
                    type="checkbox"
                    checked={limiterEnabled}
                    onChange={(e) => setLimiterEnabled(e.target.checked)}
                    disabled={isPending}
                  />
                  Master limiter
                </label>
              </div>

              <h5 className="studio-text-strong-sm studio-mt-md studio-mb-sm">EQ &amp; dynamics</h5>
              <div className="studio-trim-controls">
                <label className="studio-field studio-field--inline">
                  <span className="studio-label">High-pass (Hz)</span>
                  <input
                    type="number"
                    min={0}
                    max={2000}
                    step={1}
                    value={highPassHz}
                    onChange={(e) => setHighPassHz(Number(e.target.value))}
                    className="studio-input studio-input--narrow"
                    disabled={isPending}
                  />
                </label>
                <label className="studio-field studio-field--inline">
                  <span className="studio-label">Low-pass (Hz)</span>
                  <input
                    type="number"
                    min={0}
                    max={20000}
                    step={1}
                    value={lowPassHz}
                    onChange={(e) => setLowPassHz(Number(e.target.value))}
                    className="studio-input studio-input--narrow"
                    disabled={isPending}
                  />
                </label>
                <label className="studio-field studio-field--inline">
                  <span className="studio-label">Low shelf (dB)</span>
                  <input
                    type="number"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={lowGainDb}
                    onChange={(e) => setLowGainDb(Number(e.target.value))}
                    className="studio-input studio-input--narrow"
                    disabled={isPending}
                  />
                </label>
                <label className="studio-field studio-field--inline">
                  <span className="studio-label">Mid (dB)</span>
                  <input
                    type="number"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={midGainDb}
                    onChange={(e) => setMidGainDb(Number(e.target.value))}
                    className="studio-input studio-input--narrow"
                    disabled={isPending}
                  />
                </label>
                <label className="studio-field studio-field--inline">
                  <span className="studio-label">High shelf (dB)</span>
                  <input
                    type="number"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={highGainDb}
                    onChange={(e) => setHighGainDb(Number(e.target.value))}
                    className="studio-input studio-input--narrow"
                    disabled={isPending}
                  />
                </label>
                <label className="studio-checkbox-label">
                  <input
                    type="checkbox"
                    checked={compressorEnabled}
                    onChange={(e) => setCompressorEnabled(e.target.checked)}
                    disabled={isPending}
                  />
                  Compressor
                </label>
              </div>

              <div className="studio-row studio-row--wrap studio-mt-md">
                <input
                  type="text"
                  placeholder="Version label (e.g. Trimmed 2026-06)"
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  disabled={isPending}
                  className="studio-input studio-input--grow"
                />
                <button
                  type="button"
                  onClick={playSelection}
                  className="studio-btn-ghost"
                  disabled={isPending}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={bounce}
                  disabled={isPending || !versionLabel.trim()}
                  className="studio-btn-primary"
                >
                  {isPending ? 'Saving…' : 'Save to archive'}
                </button>
              </div>
            </>
          )}

          {error && <p className="studio-text-error studio-mt-sm studio-m-0">{error}</p>}
        </>
      )}
    </div>
  )
}
