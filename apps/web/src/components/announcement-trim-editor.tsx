// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { Button, ButtonIcon } from '@tahti/ui'
import './announcement-trim-editor.css'

export interface AnnouncementEditorClipSummary {
  id: string
  title: string
  durationSec: number | null
  renderStatus: 'READY' | 'PROCESSING' | 'ERROR'
}

export interface AnnouncementEditorSource {
  url: string
  originalUrl: string
  durationSec: number | null
  title: string
  renderStatus: 'READY' | 'PROCESSING' | 'ERROR'
}

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AnnouncementTrimEditor({
  clips,
  initialClipId,
  backHref,
  editHrefFor,
  fetchSource,
  submitRender,
}: {
  clips: AnnouncementEditorClipSummary[]
  initialClipId: string
  backHref: string
  editHrefFor: (id: string) => string
  fetchSource: (id: string) => Promise<AnnouncementEditorSource | { error: string }>
  submitRender: (
    id: string,
    patch: { startSec: number; endSec: number; fadeInSec: number; fadeOutSec: number },
  ) => Promise<{ error: string | null }>
}) {
  const router = useRouter()
  const [activeId, setActiveId] = useState(initialClipId)
  const [railOpen, setRailOpen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const regionRef = useRef<ReturnType<RegionsPlugin['addRegion']> | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<AnnouncementEditorSource | null>(null)
  const [durationSec, setDurationSec] = useState(0)
  const [startSec, setStartSec] = useState(0)
  const [endSec, setEndSec] = useState(0)
  const [fadeInSec, setFadeInSec] = useState(0)
  const [fadeOutSec, setFadeOutSec] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    let ws: WaveSurfer | null = null

    async function init() {
      setLoading(true)
      setError(null)
      setSaved(false)
      setSource(null)

      const result = await fetchSource(activeId)
      if (cancelled) return
      if ('error' in result) {
        setError(result.error)
        setLoading(false)
        return
      }
      setSource(result)

      const container = containerRef.current
      if (!container) {
        setLoading(false)
        return
      }

      ws = WaveSurfer.create({
        container,
        height: 220,
        waveColor: 'rgba(148, 163, 184, 0.45)',
        progressColor: 'rgba(34, 211, 238, 0.85)',
        cursorColor: 'rgba(34, 211, 238, 1)',
        barWidth: 2,
        barGap: 1,
        normalize: true,
        url: result.url,
      })

      const regions = ws.registerPlugin(RegionsPlugin.create())
      wavesurferRef.current = ws

      ws.on('ready', () => {
        if (cancelled || !ws) return
        const dur = ws.getDuration()
        setDurationSec(dur)
        setStartSec(0)
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
  }, [activeId, fetchSource])

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

  function save() {
    if (endSec <= startSec) {
      setError('End must be after start')
      return
    }
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const { error: saveError } = await submitRender(activeId, {
        startSec,
        endSec,
        fadeInSec,
        fadeOutSec,
      })
      if (saveError) {
        setError(saveError)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  const activeClip = clips.find((c) => c.id === activeId)

  return (
    <div className="ann-editor-fullpage">
      <div className={`ann-editor-rail ${railOpen ? 'ann-editor-rail--open' : ''}`}>
        <button
          type="button"
          className="ann-editor-rail__toggle"
          onClick={() => setRailOpen((v) => !v)}
          aria-label={railOpen ? 'Collapse clip list' : 'Load a different clip'}
          title={railOpen ? 'Collapse' : 'Load a clip'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M2 4h12M2 8h12M2 12h12"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {railOpen && (
          <div className="ann-editor-rail__list">
            {clips.map((clip) => (
              <button
                key={clip.id}
                type="button"
                className={`ann-editor-rail__item ${
                  clip.id === activeId ? 'ann-editor-rail__item--active' : ''
                }`}
                onClick={() => {
                  setActiveId(clip.id)
                  router.replace(editHrefFor(clip.id))
                }}
              >
                <span className="ann-editor-rail__item-title">{clip.title}</span>
                <span className="ann-editor-rail__item-meta">
                  {clip.durationSec != null ? formatSec(clip.durationSec) : '—'}
                  {clip.renderStatus === 'PROCESSING' ? ' · rendering…' : ''}
                  {clip.renderStatus === 'ERROR' ? ' · render failed' : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ann-editor-main">
        <div className="ann-editor-topbar">
          <h1 className="ann-editor-topbar__title">
            {activeClip?.title ?? source?.title ?? 'Trim editor'}
          </h1>
          <Button onClick={() => router.push(backHref)} variant="ghost" size="sm">
            ← Back
          </Button>
        </div>

        <div className="ann-editor-body">
          {loading && <p className="ann-editor-status">Loading audio…</p>}

          {!loading && source && (
            <>
              <div className="ann-editor-waveform-block">
                <span className="ann-editor-waveform-label">
                  Edited — drag the region to trim ({formatSec(startSec)} – {formatSec(endSec)})
                </span>
                <div ref={containerRef} className="ann-editor-waveform" />
              </div>

              <div className="ann-editor-waveform-block">
                <span className="ann-editor-waveform-label">
                  Original (unedited) — for comparison
                </span>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio
                  src={source.originalUrl}
                  controls
                  className="ann-editor-original-audio"
                />
              </div>

              <div className="ann-editor-controls">
                <label className="ann-editor-field">
                  Fade in (s)
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.1}
                    value={fadeInSec}
                    onChange={(e) => setFadeInSec(Number(e.target.value))}
                    disabled={isPending}
                  />
                </label>
                <label className="ann-editor-field">
                  Fade out (s)
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.1}
                    value={fadeOutSec}
                    onChange={(e) => setFadeOutSec(Number(e.target.value))}
                    disabled={isPending}
                  />
                </label>
                <div className="ann-editor-actions">
                  <Button onClick={playSelection} disabled={isPending} variant="ghost" size="sm">
                    <ButtonIcon name="play" />
                    Preview selection
                  </Button>
                  <Button onClick={save} disabled={isPending || durationSec === 0} variant="primary">
                    <ButtonIcon name="save" />
                    {isPending ? 'Saving…' : 'Apply'}
                  </Button>
                </div>
              </div>

              {saved && !error && (
                <p className="ann-editor-status">
                  Saved — re-rendering in the background, this clip will update automatically.
                </p>
              )}
            </>
          )}

          {error && <p className="ann-editor-status ann-editor-status--error">{error}</p>}
        </div>
      </div>
    </div>
  )
}
