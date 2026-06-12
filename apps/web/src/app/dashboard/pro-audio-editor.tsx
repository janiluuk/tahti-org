// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditList, PeaksPyramid } from '@tahti/audio-edit'
import {
  postCutDuration,
  computeKeepSegments,
  mergeCuts,
  shouldRenderInBrowser,
} from '@tahti/audio-edit'
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { Panel } from '@tahti/ui'
import {
  completeArchiveVersionUpload,
  prepareArchiveVersionUpload,
  renderArchiveEditList,
  saveArchiveEditListDraft,
  waitForArchiveVersionReady,
} from './archive-actions'
import {
  fetchSourceFile,
  generatePeaksFromFfmpeg,
  loadFfmpeg,
  measureLoudnorm,
  mountSourceFile,
  renderEditToFile,
  unmountSource,
} from '@/lib/audio-editor/ffmpeg-client'
import { loadPeaksCache, savePeaksCache } from '@/lib/audio-editor/peaks-cache'
import { attachPreviewGraph, readPeakLevel } from '@/lib/audio-editor/preview-audio'
import { drawOverlayLayer, drawWaveformLayer } from '@/lib/audio-editor/waveform-draw'

const HISTORY_CAP = 100
const AUTOSAVE_MS = 2000

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function RackModule({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string
  enabled: boolean
  onToggle: (on: boolean) => void
  children: React.ReactNode
}) {
  return (
    <Panel className="pro-editor-rack-module">
      <div className="pro-editor-rack-module__head">
        <h3 className="pro-editor-rack-module__title">{title}</h3>
        <label className="pro-editor-toggle">
          <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
          <span className="pro-editor-toggle__track" aria-hidden />
        </label>
      </div>
      <div className={enabled ? undefined : 'pro-editor-rack-module__body--bypassed'}>
        {children}
      </div>
    </Panel>
  )
}

export function ProAudioEditor({
  archiveId,
  title,
  sourceUrl,
  sourceKey,
  initialEditList,
  draftUpdatedAt,
}: {
  archiveId: string
  title: string
  sourceUrl: string
  sourceKey: string
  initialEditList: EditList
  draftUpdatedAt: string | null
}) {
  const [editList, setEditList] = useState(initialEditList)
  const [past, setPast] = useState<EditList[]>([])
  const [future, setFuture] = useState<EditList[]>([])
  const [autosaveLabel, setAutosaveLabel] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isolated, setIsolated] = useState(false)
  const [peaks, setPeaks] = useState<PeaksPyramid | null>(null)
  const [peaksLoading, setPeaksLoading] = useState(true)
  const [ffmpeg, setFfmpeg] = useState<FFmpeg | null>(null)
  const [ffmpegLoading, setFfmpegLoading] = useState(true)
  const [exportProgress, setExportProgress] = useState<number | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [meterPeak, setMeterPeak] = useState(0)
  const [viewStart, setViewStart] = useState(0)
  const [viewEnd, setViewEnd] = useState(1)
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)

  const waveRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const inputPathRef = useRef<string | null>(null)
  const sourceFileRef = useRef<File | null>(null)
  const previewRef = useRef<ReturnType<typeof attachPreviewGraph> | null>(null)

  const pushHistory = useCallback((updater: EditList | ((prev: EditList) => EditList)) => {
    setEditList((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      setPast((p) => [...p.slice(-(HISTORY_CAP - 1)), prev])
      setFuture([])
      return next
    })
  }, [])

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p
      const prev = p[p.length - 1]!
      setEditList((cur) => {
        setFuture((f) => [cur, ...f])
        return prev
      })
      return p.slice(0, -1)
    })
  }, [])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f
      const next = f[0]!
      setEditList((cur) => {
        setPast((p) => [...p, cur])
        return next
      })
      return f.slice(1)
    })
  }, [])

  useEffect(() => {
    setIsolated(typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      void saveArchiveEditListDraft(archiveId, editList).then((res) => {
        if (res.error) setSaveError(res.error)
        else {
          setSaveError(null)
          setAutosaveLabel('just now')
        }
      })
    }, AUTOSAVE_MS)
    return () => clearTimeout(t)
  }, [archiveId, editList])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setFfmpegLoading(true)
      try {
        const ff = await loadFfmpeg((r) => {
          if (exportProgress !== null) setExportProgress(r)
        })
        if (cancelled) return
        setFfmpeg(ff)
        const file = await fetchSourceFile(sourceUrl)
        sourceFileRef.current = file
        const path = await mountSourceFile(ff, file)
        inputPathRef.current = path

        const cached = await loadPeaksCache(archiveId, sourceKey)
        if (cached) {
          setPeaks(cached)
          setPeaksLoading(false)
          return
        }

        const pyramid = await generatePeaksFromFfmpeg(ff, path, editList.sourceDuration)
        await savePeaksCache(archiveId, sourceKey, pyramid)
        if (!cancelled) setPeaks(pyramid)
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Failed to init ffmpeg')
      } finally {
        if (!cancelled) {
          setPeaksLoading(false)
          setFfmpegLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
      void ffmpeg?.terminate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per source
  }, [archiveId, sourceKey, sourceUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    previewRef.current?.disconnect()
    previewRef.current = attachPreviewGraph(audio, editList)
    return () => previewRef.current?.disconnect()
  }, [editList])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (previewRef.current) setMeterPeak(readPeakLevel(previewRef.current.analyser))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const redraw = useCallback(() => {
    const pyramid = peaks
    const wave = waveRef.current
    const overlay = overlayRef.current
    const audio = audioRef.current
    if (!pyramid || !wave || !overlay) return

    const view = {
      viewStart,
      viewEnd,
      playheadSec: audio?.currentTime ?? 0,
      selection,
    }

    const wctx = wave.getContext('2d')
    const octx = overlay.getContext('2d')
    if (wctx) drawWaveformLayer(wctx, pyramid, view, editList.cuts)
    if (octx) drawOverlayLayer(octx, pyramid, view)
  }, [peaks, viewStart, viewEnd, selection, editList.cuts])

  useEffect(() => {
    redraw()
  }, [redraw])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => redraw()
    audio.addEventListener('timeupdate', onTime)
    return () => audio.removeEventListener('timeupdate', onTime)
  }, [redraw])

  const segments = useMemo(
    () => computeKeepSegments(editList.sourceDuration, mergeCuts(editList.cuts)),
    [editList],
  )
  const postDuration = useMemo(() => postCutDuration(segments), [segments])
  const browserRender = useMemo(() => shouldRenderInBrowser(editList), [editList])

  const loudnormPreviewDb =
    editList.loudnorm.enabled && editList.loudnorm.measured
      ? editList.loudnorm.targetLufs - editList.loudnorm.measured.i
      : null

  function removeSelection() {
    if (!selection) return
    pushHistory({
      ...editList,
      cuts: [...editList.cuts, { start: selection.start, end: selection.end }],
    })
    setSelection(null)
  }

  async function handleExport() {
    setExportError(null)
    setExportProgress(0)
    const label = `Pro edit ${new Date().toISOString().slice(0, 10)}`

    try {
      if (!browserRender) {
        const res = await renderArchiveEditList(archiveId, {
          editList,
          versionLabel: label,
          activate: true,
          format: 'flac',
        })
        if (res.error || !res.versionId) throw new Error(res.error ?? 'Server render failed')

        const poll = await waitForArchiveVersionReady(archiveId, res.versionId)
        if (!poll.ready) throw new Error(poll.error ?? 'Server render failed')
        setExportProgress(null)
        return
      }

      if (!ffmpeg || !inputPathRef.current) return

      let list = editList
      if (list.loudnorm.enabled && !list.loudnorm.measured) {
        const measured = await measureLoudnorm(ffmpeg, list, inputPathRef.current)
        if (measured) {
          list = { ...list, loudnorm: { ...list.loudnorm, measured } }
          setEditList(list)
        }
      }

      const out = await renderEditToFile(ffmpeg, list, inputPathRef.current, 'flac')
      const blob = new Blob([out], { type: 'audio/flac' })
      const prep = await prepareArchiveVersionUpload(archiveId, {
        filename: 'edit.flac',
        contentType: 'audio/flac',
      })
      if (prep.error || !prep.uploadUrl || !prep.uploadId)
        throw new Error(prep.error ?? 'Prepare failed')

      await fetch(prep.uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'audio/flac' },
      })
      const done = await completeArchiveVersionUpload(archiveId, {
        uploadId: prep.uploadId,
        versionLabel: label,
        fileSizeBytes: blob.size,
      })
      if (done.error) throw new Error(done.error)
      setExportProgress(null)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
      setExportProgress(null)
    }
  }

  useEffect(() => {
    return () => {
      if (ffmpeg) void unmountSource(ffmpeg)
    }
  }, [ffmpeg])

  return (
    <div className="pro-editor-shell">
      <header className="pro-editor-header">
        <div className="pro-editor-header__left">
          <Link href="/dashboard" className="pro-editor-exit">
            ← Archive
          </Link>
          <h1 className="pro-editor-title">{title}</h1>
        </div>
        <div className="pro-editor-header__right">
          {autosaveLabel && <span className="pro-editor-autosave">autosaved {autosaveLabel}</span>}
          {draftUpdatedAt && !autosaveLabel && (
            <span className="pro-editor-autosave">
              loaded {new Date(draftUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          {saveError && <span className="studio-text-error">{saveError}</span>}
          <button type="button" className="studio-btn-ghost" onClick={undo} disabled={!past.length}>
            Undo
          </button>
          <button
            type="button"
            className="studio-btn-ghost"
            onClick={redo}
            disabled={!future.length}
          >
            Redo
          </button>
        </div>
      </header>

      <div className="pro-editor-body">
        <section className="pro-editor-wave" aria-label="Waveform">
          {peaksLoading && <p className="pro-editor-hint">Generating waveform peaks…</p>}
          <div className="pro-editor-canvas-stack">
            <canvas ref={waveRef} className="pro-editor-canvas" width={1280} height={160} />
            <canvas
              ref={overlayRef}
              className="pro-editor-canvas pro-editor-canvas--overlay"
              width={1280}
              height={160}
              onMouseDown={(e) => {
                if (!peaks) return
                const rect = e.currentTarget.getBoundingClientRect()
                const frac = (e.clientX - rect.left) / rect.width
                const sec = peaks.durationSec * (viewStart + frac * (viewEnd - viewStart))
                setSelection({ start: sec, end: sec })
              }}
              onMouseMove={(e) => {
                if (!peaks || !selection || e.buttons !== 1) return
                const rect = e.currentTarget.getBoundingClientRect()
                const frac = (e.clientX - rect.left) / rect.width
                const sec = peaks.durationSec * (viewStart + frac * (viewEnd - viewStart))
                setSelection({
                  start: Math.min(selection.start, sec),
                  end: Math.max(selection.start, sec),
                })
              }}
              onWheel={(e) => {
                if (!peaks) return
                e.preventDefault()
                const rect = e.currentTarget.getBoundingClientRect()
                const cursorFrac = (e.clientX - rect.left) / rect.width
                const span = viewEnd - viewStart
                const zoom = e.deltaY > 0 ? 1.15 : 0.87
                const newSpan = Math.min(1, Math.max(0.01, span * zoom))
                const center = viewStart + cursorFrac * span
                let ns = center - cursorFrac * newSpan
                let ne = ns + newSpan
                if (ns < 0) {
                  ne -= ns
                  ns = 0
                }
                if (ne > 1) {
                  ns -= ne - 1
                  ne = 1
                }
                setViewStart(Math.max(0, ns))
                setViewEnd(Math.min(1, ne))
              }}
            />
          </div>
          <div className="pro-editor-wave-toolbar">
            <button
              type="button"
              className="studio-btn-ghost"
              disabled={!selection}
              onClick={removeSelection}
            >
              Remove selection
            </button>
            <button
              type="button"
              className="studio-btn-ghost"
              onClick={() => {
                setViewStart(0)
                setViewEnd(1)
              }}
            >
              Reset zoom
            </button>
            <div className="pro-editor-meter" aria-hidden>
              <div className="pro-editor-meter__fill" style={{ width: `${meterPeak * 100}%` }} />
            </div>
          </div>
          <audio
            ref={audioRef}
            src={sourceUrl}
            controls
            className="pro-editor-audio"
            crossOrigin="anonymous"
            preload="metadata"
          />
        </section>

        <aside className="pro-editor-rack" aria-label="Processing rack">
          <RackModule title="Gain" enabled onToggle={() => undefined}>
            <label className="studio-field">
              <span>Gain (dB)</span>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.1}
                value={editList.gainDb}
                onChange={(e) => pushHistory({ ...editList, gainDb: Number(e.target.value) })}
              />
            </label>
            {loudnormPreviewDb !== null && (
              <p className="pro-editor-preview-gain">
                preview ≈ {loudnormPreviewDb > 0 ? '+' : ''}
                {loudnormPreviewDb.toFixed(1)} dB
              </p>
            )}
          </RackModule>

          <RackModule
            title="EQ"
            enabled={editList.eq.enabled}
            onToggle={(on) => pushHistory({ ...editList, eq: { ...editList.eq, enabled: on } })}
          >
            {editList.eq.bands.map((band, i) => (
              <label key={band.freq} className="studio-field">
                <span>{band.freq} Hz</span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={band.gainDb}
                  onChange={(e) => {
                    const bands = editList.eq.bands.map((b, j) =>
                      j === i ? { ...b, gainDb: Number(e.target.value) } : b,
                    )
                    pushHistory({ ...editList, eq: { ...editList.eq, bands } })
                  }}
                />
              </label>
            ))}
          </RackModule>

          <RackModule
            title="Compressor"
            enabled={editList.comp.enabled}
            onToggle={(on) => pushHistory({ ...editList, comp: { ...editList.comp, enabled: on } })}
          >
            <p className="pro-editor-hint">
              {editList.comp.thresholdDb} dB · {editList.comp.ratio}:1
            </p>
          </RackModule>

          <RackModule
            title="LUFS normalize"
            enabled={editList.loudnorm.enabled}
            onToggle={(on) =>
              pushHistory({ ...editList, loudnorm: { ...editList.loudnorm, enabled: on } })
            }
          >
            <p className="pro-editor-hint">
              Target {editList.loudnorm.targetLufs} LUFS
              {editList.loudnorm.measured &&
                ` · measured ${editList.loudnorm.measured.i.toFixed(1)}`}
            </p>
          </RackModule>
        </aside>
      </div>

      <footer className="pro-editor-export">
        <div className="pro-editor-export__meta">
          <span className="pro-editor-format-pill pro-editor-format-pill--active">FLAC</span>
          <span>Duration: {formatDuration(postDuration)}</span>
          <span>
            {browserRender ? 'Browser render' : 'Server worker'}
            {ffmpegLoading ? ' · loading ffmpeg…' : ''}
            {!isolated && ' · single-thread'}
          </span>
        </div>
        <p className="pro-editor-trust">
          Renders on your CPU · uploads only the result · original kept
        </p>
        {exportProgress !== null && (
          <div className="pro-editor-progress">
            <div
              className="pro-editor-progress__bar"
              style={{ width: `${exportProgress * 100}%` }}
            />
          </div>
        )}
        {exportError && <p className="studio-text-error">{exportError}</p>}
        <button
          type="button"
          className="studio-btn-primary"
          disabled={exportProgress !== null || (browserRender && (!ffmpeg || ffmpegLoading))}
          onClick={() => void handleExport()}
        >
          {browserRender ? 'Export FLAC' : 'Export FLAC (server)'}
        </button>
      </footer>
    </div>
  )
}
