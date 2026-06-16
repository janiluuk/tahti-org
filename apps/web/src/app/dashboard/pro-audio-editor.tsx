// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditList, OutputFormat, PeaksPyramid } from '@tahti/audio-edit'
import {
  postCutDuration,
  computeKeepSegments,
  mergeCuts,
  remapTracklistTimestamps,
  shouldRenderInBrowser,
  snapToNearestZeroCrossing,
  DEFAULT_EQ_BANDS,
  DEFAULT_COMP,
  DEFAULT_LIMITER,
} from '@tahti/audio-edit'
import type { TracklistEntry } from '@tahti/shared'
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { Knob } from '@tahti/ui'
import {
  completeArchiveVersionUpload,
  prepareArchiveVersionUpload,
  renderArchiveEditList,
  fetchArchiveVersionDownloadUrl,
  saveArchiveEditListDraft,
  updateArchiveMetadata,
} from './archive-actions'
import { TracklistEditor } from './tracklist-editor'
import {
  generatePeaksFromFfmpeg,
  loadFfmpeg,
  measureLoudnorm,
  mountSourceFile,
  renderEditToFile,
  unmountSource,
} from '@/lib/audio-editor/ffmpeg-client'
import { loadPeaksCache, savePeaksCache } from '@/lib/audio-editor/peaks-cache'
import {
  attachPreviewGraph,
  createPreviewSource,
  readGainReductionDb,
  readPeakLevel,
} from '@/lib/audio-editor/preview-audio'
import {
  drawMinimapLayer,
  drawOverlayLayer,
  drawWaveformLayer,
} from '@/lib/audio-editor/waveform-draw'
import { EQ_BAND_COLORS, EqCurve } from '@/lib/audio-editor/eq-curve'
import { waitForRenderViaProgress } from '@/lib/audio-editor/render-progress'

const HISTORY_CAP = 100
const AUTOSAVE_MS = 2000
const AUTOSAVE_KNOB_MS = 6000
const CANVAS_MIN_WIDTH = 320
const CANVAS_DEFAULT_WIDTH = 1280
const WAVE_HEIGHT = 210
const MINIMAP_HEIGHT = 38

type EditorTab = 'waveform' | 'tracklist'

type FocusedPlugin = 'gain' | 'eq' | 'comp' | 'limiter'
type ToolId = 'select' | 'cut' | 'fade' | 'marker'

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

function formatRelativeSave(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 12) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  return new Date(ts).toLocaleTimeString()
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDurationDecimal(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

function dbReadout(db: number): string {
  if (db <= -60) return '−∞'
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="pro-editor-switch"
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
    >
      <span className="pro-editor-switch__thumb" aria-hidden />
    </button>
  )
}

function PlugItem({
  position,
  name,
  summary,
  enabled,
  focused,
  onFocus,
  onToggle,
}: {
  position: number
  name: string
  summary: string
  enabled: boolean
  focused: boolean
  onFocus: () => void
  onToggle: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      className={cx('plug', focused && 'plug--focused', !enabled && 'plug--bypassed')}
      onClick={onFocus}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onFocus()
      }}
    >
      <div className="plug__head">
        <span className="plug__name">
          {position} · {name}
        </span>
        <Switch checked={enabled} onChange={onToggle} label={`${name} enabled`} />
      </div>
      <div className="plug__summary">{summary}</div>
    </button>
  )
}

export function ProAudioEditor({
  archiveId,
  title,
  sourceUrl,
  sourceKey,
  sourceFileSizeBytes,
  initialEditList,
  draftUpdatedAt,
  initialTracklist,
  initialEditorPeaks,
}: {
  archiveId: string
  title: string
  sourceUrl: string
  sourceKey: string
  sourceFileSizeBytes: number | null
  initialEditList: EditList
  draftUpdatedAt: string | null
  initialTracklist?: TracklistEntry[] | null
  initialEditorPeaks?: PeaksPyramid | null
}) {
  const [editList, setEditList] = useState(initialEditList)
  const [past, setPast] = useState<EditList[]>([])
  const [future, setFuture] = useState<EditList[]>([])
  const [autosaveLabel, setAutosaveLabel] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [draftConflict, setDraftConflict] = useState(false)
  const [knobDragging, setKnobDragging] = useState(false)
  const [isolated, setIsolated] = useState(false)
  const [peaks, setPeaks] = useState<PeaksPyramid | null>(null)
  const [peaksLoading, setPeaksLoading] = useState(true)
  const [ffmpeg, setFfmpeg] = useState<FFmpeg | null>(null)
  const [ffmpegLoading, setFfmpegLoading] = useState(true)
  const [exportProgress, setExportProgress] = useState<number | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportFormat, setExportFormat] = useState<OutputFormat>('flac')
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportSuccess, setExportSuccess] = useState<{
    versionNumber: number
    versionLabel: string
  } | null>(null)
  const [meterPeak, setMeterPeak] = useState(0)
  const [grDb, setGrDb] = useState(0)
  const [viewStart, setViewStart] = useState(0)
  const [viewEnd, setViewEnd] = useState(1)
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)
  const [activeTool, setActiveTool] = useState<ToolId>('select')
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [measuring, setMeasuring] = useState(false)
  const [focusedPlugin, setFocusedPlugin] = useState<FocusedPlugin>('gain')
  const [activeTab, setActiveTab] = useState<EditorTab>('waveform')
  const [tracklist, setTracklist] = useState<TracklistEntry[] | null>(initialTracklist ?? null)
  const [tracklistError, setTracklistError] = useState<string | null>(null)
  const [tracklistSaving, setTracklistSaving] = useState(false)
  const [canvasWidth, setCanvasWidth] = useState(CANVAS_DEFAULT_WIDTH)
  const [exportPhase, setExportPhase] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(
    draftUpdatedAt ? new Date(draftUpdatedAt).getTime() : null,
  )

  const wavePanelRef = useRef<HTMLDivElement>(null)
  const waveRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const minimapRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const inputPathRef = useRef<string | null>(null)
  const sourceFileRef = useRef<File | null>(null)
  const sourceBlobUrlRef = useRef<string | null>(null)
  const autosavePendingRef = useRef(false)
  const draftUpdatedAtRef = useRef<string | null>(draftUpdatedAt)
  const editListRef = useRef(editList)
  editListRef.current = editList
  const previewRef = useRef<ReturnType<typeof attachPreviewGraph> | null>(null)
  const previewSourceRef = useRef<ReturnType<typeof createPreviewSource> | null>(null)

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

  // Restore the focused plugin panel from the URL hash so it persists across reloads.
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash === 'gain' || hash === 'eq' || hash === 'comp' || hash === 'limiter') {
      setFocusedPlugin(hash)
    }
  }, [])

  const focusPlugin = useCallback((plugin: FocusedPlugin) => {
    setFocusedPlugin(plugin)
    window.history.replaceState(null, '', `#${plugin}`)
  }, [])

  const flushDraftSave = useCallback(async () => {
    autosavePendingRef.current = true
    const res = await saveArchiveEditListDraft(
      archiveId,
      editListRef.current,
      draftUpdatedAtRef.current,
    )
    autosavePendingRef.current = false
    if (res.conflict) {
      setDraftConflict(true)
      setSaveError(res.error ?? 'Draft conflict')
      if (res.updatedAt) draftUpdatedAtRef.current = res.updatedAt
      return
    }
    if (res.error) {
      setSaveError(res.error)
      return
    }
    setDraftConflict(false)
    setSaveError(null)
    if (res.updatedAt) {
      draftUpdatedAtRef.current = res.updatedAt
      const ts = new Date(res.updatedAt).getTime()
      setLastSavedAt(ts)
      setAutosaveLabel(formatRelativeSave(ts))
    } else {
      const ts = Date.now()
      setLastSavedAt(ts)
      setAutosaveLabel('just now')
    }
  }, [archiveId])

  useEffect(() => {
    if (!lastSavedAt) return
    setAutosaveLabel(formatRelativeSave(lastSavedAt))
    const t = setInterval(() => setAutosaveLabel(formatRelativeSave(lastSavedAt)), 15000)
    return () => clearInterval(t)
  }, [lastSavedAt])

  useEffect(() => {
    draftUpdatedAtRef.current = draftUpdatedAt
  }, [draftUpdatedAt])

  useEffect(() => {
    if (knobDragging) return
    autosavePendingRef.current = true
    const delay = knobDragging ? AUTOSAVE_KNOB_MS : AUTOSAVE_MS
    const t = setTimeout(() => {
      void flushDraftSave()
    }, delay)
    return () => clearTimeout(t)
  }, [archiveId, editList, knobDragging, flushDraftSave])

  useEffect(() => {
    if (!knobDragging) return
    function onPointerUp() {
      setKnobDragging(false)
      void flushDraftSave()
    }
    window.addEventListener('pointerup', onPointerUp)
    return () => window.removeEventListener('pointerup', onPointerUp)
  }, [knobDragging, flushDraftSave])

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (exportProgress !== null || saveError || autosavePendingRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [exportProgress, saveError, editList])

  const snapSec = useCallback(
    (sec: number) => {
      if (!snapEnabled || !peaks?.zeroCrossingsSec?.length) return sec
      return snapToNearestZeroCrossing(peaks.zeroCrossingsSec, sec)
    },
    [snapEnabled, peaks?.zeroCrossingsSec],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setFfmpegLoading(true)
      try {
        const res = await fetch(sourceUrl, { credentials: 'include', cache: 'no-store' })
        if (!res.ok) throw new Error(`Failed to fetch source audio (${res.status})`)
        const blob = await res.blob()
        if (cancelled) return

        const blobUrl = URL.createObjectURL(blob)
        sourceBlobUrlRef.current = blobUrl
        if (audioRef.current) audioRef.current.src = blobUrl

        const file = new File([blob], 'source.flac', { type: blob.type || 'audio/flac' })
        sourceFileRef.current = file

        const ff = await loadFfmpeg((r) => {
          if (exportProgress !== null) setExportProgress(r)
        })
        if (cancelled) return
        setFfmpeg(ff)

        const path = await mountSourceFile(ff, file)
        inputPathRef.current = path

        const cached = await loadPeaksCache(archiveId, sourceKey)
        if (cached) {
          setPeaks(cached)
          setPeaksLoading(false)
          return
        }

        if (initialEditorPeaks?.levels?.length) {
          setPeaks(initialEditorPeaks)
          await savePeaksCache(archiveId, sourceKey, initialEditorPeaks)
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
      if (sourceBlobUrlRef.current) {
        URL.revokeObjectURL(sourceBlobUrlRef.current)
        sourceBlobUrlRef.current = null
      }
      void ffmpeg?.terminate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per source
  }, [archiveId, sourceKey, sourceUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    previewSourceRef.current = createPreviewSource(audio)
    return () => {
      // Note: the AudioContext is intentionally not closed here — `createMediaElementSource`
      // can only ever be called once per <audio> element, so the source is cached per
      // element (see createPreviewSource) and survives React StrictMode's
      // mount→cleanup→mount cycle in development.
      previewRef.current?.disconnect()
      previewRef.current = null
      previewSourceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create the source node once per mount
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    const source = previewSourceRef.current
    if (!audio || !source) return
    previewRef.current?.disconnect()
    previewRef.current = attachPreviewGraph(source, audio, editList)
    return () => previewRef.current?.disconnect()
  }, [editList])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (!playing && !measuring && !previewLoading) return
      if (previewRef.current) {
        setMeterPeak(readPeakLevel(previewRef.current.analyser))
        setGrDb(
          readGainReductionDb(
            previewRef.current.preCompAnalyser,
            previewRef.current.postCompAnalyser,
          ),
        )
      }
      raf = requestAnimationFrame(tick)
    }
    if (playing || measuring || previewLoading) {
      raf = requestAnimationFrame(tick)
    }
    return () => cancelAnimationFrame(raf)
  }, [playing, measuring, previewLoading])

  const redraw = useCallback(() => {
    const pyramid = peaks
    const wave = waveRef.current
    const overlay = overlayRef.current
    const minimap = minimapRef.current
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
    if (minimap) {
      const mctx = minimap.getContext('2d')
      if (mctx) drawMinimapLayer(mctx, pyramid)
    }
  }, [peaks, viewStart, viewEnd, selection, editList.cuts])

  useEffect(() => {
    redraw()
  }, [redraw])

  useEffect(() => {
    redraw()
  }, [canvasWidth, redraw])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => {
      setCurrentTime(audio.currentTime)
      redraw()
    }
    audio.addEventListener('timeupdate', onTime)
    return () => audio.removeEventListener('timeupdate', onTime)
  }, [redraw])

  const segments = useMemo(
    () => computeKeepSegments(editList.sourceDuration, mergeCuts(editList.cuts)),
    [editList],
  )
  const postDuration = useMemo(() => postCutDuration(segments), [segments])
  const browserRender = useMemo(
    () => shouldRenderInBrowser(editList, sourceFileSizeBytes),
    [editList, sourceFileSizeBytes],
  )

  const renderModePill = browserRender
    ? ffmpegLoading
      ? 'Loading ffmpeg…'
      : `ffmpeg.wasm · LOCAL${!isolated ? ' · 1 thread' : ''}`
    : 'Server worker render'

  const appliedDb =
    editList.loudnorm.enabled && editList.loudnorm.measured
      ? editList.loudnorm.targetLufs - editList.loudnorm.measured.i
      : null

  function setSpan(rawSpan: number) {
    const span = Math.min(1, Math.max(0.001, rawSpan))
    const center = (viewStart + viewEnd) / 2
    let ns = center - span / 2
    let ne = ns + span
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
  }

  const span = viewEnd - viewStart
  const zoomSliderValue = Math.round(
    Math.min(1000, Math.max(0, -1000 * Math.log10(span) * (1 / 3))),
  )
  const msPerPx = (span * editList.sourceDuration * 1000) / canvasWidth

  const snappedSelection = useCallback((): { start: number; end: number } | null => {
    if (!selection) return null
    if (snapEnabled && peaks?.zeroCrossingsSec?.length) {
      return {
        start: snapToNearestZeroCrossing(peaks.zeroCrossingsSec, selection.start),
        end: snapToNearestZeroCrossing(peaks.zeroCrossingsSec, selection.end),
      }
    }
    return selection
  }, [selection, snapEnabled, peaks?.zeroCrossingsSec])

  const remappedTracklist = useMemo(
    () => (tracklist?.length ? remapTracklistTimestamps(tracklist, editList) : []),
    [tracklist, editList],
  )

  useEffect(() => {
    const el = wavePanelRef.current
    if (!el) return
    const measure = () => setCanvasWidth(Math.max(CANVAS_MIN_WIDTH, Math.floor(el.clientWidth)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const secFromCanvasEvent = useCallback(
    (clientX: number, rect: DOMRect) => {
      if (!peaks) return 0
      const frac = (clientX - rect.left) / rect.width
      return peaks.durationSec * (viewStart + frac * (viewEnd - viewStart))
    },
    [peaks, viewStart, viewEnd],
  )

  const seekToSec = useCallback(
    (sec: number) => {
      const clamped = Math.max(0, Math.min(editList.sourceDuration, sec))
      if (audioRef.current) audioRef.current.currentTime = clamped
      const center = clamped / editList.sourceDuration
      const half = span / 2
      let ns = center - half
      let ne = ns + span
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
    },
    [editList.sourceDuration, span],
  )

  const beginKnobDrag = useCallback(() => setKnobDragging(true), [])

  async function saveTracklist() {
    setTracklistSaving(true)
    setTracklistError(null)
    const res = await updateArchiveMetadata(archiveId, { tracklist })
    setTracklistSaving(false)
    if (res.error) setTracklistError(res.error)
  }

  const removeSelection = useCallback(() => {
    const final = snappedSelection()
    if (!final) return
    pushHistory({
      ...editList,
      cuts: [...editList.cuts, { start: final.start, end: final.end }],
    })
    setSelection(null)
  }, [editList, pushHistory, snappedSelection])

  const applyFadeAtSelection = useCallback(() => {
    const final = snappedSelection()
    if (!final) return
    const dur = Math.max(0.05, Math.min(5, final.end - final.start))
    pushHistory({
      ...editList,
      fades: [
        ...editList.fades,
        { type: 'in', at: final.start, duration: dur, curve: 'tri' },
        {
          type: 'out',
          at: Math.max(final.start, final.end - dur),
          duration: dur,
          curve: 'tri',
        },
      ],
    })
    setSelection(null)
  }, [editList, pushHistory, snappedSelection])

  async function handleMeasure() {
    if (!ffmpeg || !inputPathRef.current) return
    setMeasuring(true)
    try {
      const base = editList.loudnorm.enabled
        ? editList
        : { ...editList, loudnorm: { ...editList.loudnorm, enabled: true } }
      const measured = await measureLoudnorm(ffmpeg, base, inputPathRef.current)
      pushHistory(measured ? { ...base, loudnorm: { ...base.loudnorm, measured } } : base)
    } finally {
      setMeasuring(false)
    }
  }

  async function handlePreviewSample() {
    setPreviewError(null)
    setPreviewLoading(true)
    try {
      if (browserRender && ffmpeg && inputPathRef.current) {
        const out = await renderEditToFile(
          ffmpeg,
          editList,
          inputPathRef.current,
          'mp3',
          undefined,
          {
            maxDurationSec: 30,
          },
        )
        const blob = new Blob([new Uint8Array(out)], { type: 'audio/mpeg' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${title.replace(/\s+/g, '-').slice(0, 40)}-preview-30s.mp3`
        a.click()
        URL.revokeObjectURL(url)
        return
      }

      const res = await renderArchiveEditList(archiveId, {
        editList,
        versionLabel: `Preview ${new Date().toISOString().slice(0, 16)}`,
        activate: false,
        format: 'mp3',
        maxDurationSec: 30,
        sampleOnly: true,
      })
      if (res.error || !res.versionId) throw new Error(res.error ?? 'Server preview failed')

      await waitForRenderViaProgress(archiveId, res.versionId, (event) => {
        if (typeof event.pct === 'number') setExportProgress(event.pct)
        if (event.phase) setExportPhase(event.phase)
      })
      setExportProgress(null)
      setExportPhase(null)

      const dl = await fetchArchiveVersionDownloadUrl(archiveId, res.versionId)
      if (dl.error || !dl.url) throw new Error(dl.error ?? 'Preview download unavailable')

      const a = document.createElement('a')
      a.href = dl.url
      a.download = `${title.replace(/\s+/g, '-').slice(0, 40)}-preview-30s.mp3`
      a.rel = 'noopener'
      a.click()
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : 'Preview render failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleExport(format: OutputFormat) {
    setExportError(null)
    setExportSuccess(null)
    setExportProgress(0)
    const label = `Pro edit ${new Date().toISOString().slice(0, 10)}`

    try {
      if (!browserRender) {
        const res = await renderArchiveEditList(archiveId, {
          editList,
          versionLabel: label,
          activate: true,
          format: format === 'wav' ? 'flac' : format,
        })
        if (res.error || !res.versionId) throw new Error(res.error ?? 'Server render failed')

        const done = await waitForRenderViaProgress(archiveId, res.versionId, (event) => {
          if (typeof event.pct === 'number') setExportProgress(event.pct)
          if (event.phase) setExportPhase(event.phase)
        })
        setExportProgress(null)
        setExportPhase(null)
        setExportSuccess({
          versionNumber: done.versionNumber ?? res.versionNumber ?? 0,
          versionLabel: done.versionLabel ?? label,
        })
        setExportDialogOpen(false)
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

      const out = await renderEditToFile(ffmpeg, list, inputPathRef.current, format)
      const contentType =
        format === 'mp3' ? 'audio/mpeg' : format === 'wav' ? 'audio/wav' : 'audio/flac'
      const filename = `edit.${format}`
      const bytes = new Uint8Array(out)
      const blob = new Blob([bytes], { type: contentType })
      const prep = await prepareArchiveVersionUpload(archiveId, {
        filename,
        contentType,
      })
      if (prep.error || !prep.uploadUrl || !prep.uploadId)
        throw new Error(prep.error ?? 'Prepare failed')

      await fetch(prep.uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': contentType },
      })
      const done = await completeArchiveVersionUpload(archiveId, {
        uploadId: prep.uploadId,
        versionLabel: label,
        fileSizeBytes: blob.size,
      })
      if (done.error) throw new Error(done.error)
      setExportProgress(null)
      setExportSuccess({
        versionNumber: done.versionNumber ?? 0,
        versionLabel: label,
      })
      setExportDialogOpen(false)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
      setExportProgress(null)
      setExportPhase(null)
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.code === 'Space') {
        e.preventDefault()
        const audio = audioRef.current
        if (!audio) return
        if (audio.paused) void audio.play()
        else audio.pause()
        return
      }

      if ((e.key === 'x' || e.key === 'X') && selection) {
        e.preventDefault()
        removeSelection()
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || e.key === 'y')) {
        e.preventDefault()
        redo()
        return
      }

      if (e.key === 'Escape') {
        setSelection(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selection, activeTool, undo, redo, removeSelection, applyFadeAtSelection])

  useEffect(() => {
    return () => {
      if (ffmpeg) void unmountSource(ffmpeg)
    }
  }, [ffmpeg])

  // ---- Rail summaries (single source of truth: EditList) ----
  const gainSummary = `${editList.gainDb >= 0 ? '+' : ''}${editList.gainDb.toFixed(1)} dB → ${editList.loudnorm.targetLufs} LUFS${
    appliedDb !== null ? ` (${appliedDb >= 0 ? '+' : ''}${appliedDb.toFixed(1)})` : ''
  }`
  const eqSummary = editList.eq.bands
    .map((b) => `${b.gainDb >= 0 ? '+' : ''}${b.gainDb.toFixed(1)}`)
    .join(' · ')
    .concat(' dB')
  const compSummary = editList.comp.enabled
    ? `${editList.comp.thresholdDb} dB · ${editList.comp.ratio}:1 · ${editList.comp.attackMs} ms`
    : 'bypassed'
  const limiterSummary = editList.limiter.enabled
    ? `${editList.limiter.ceilingDb} dBTP ceiling`
    : 'bypassed'

  const integratedDisplay = editList.loudnorm.enabled ? `${editList.loudnorm.targetLufs} LUFS` : '—'
  const truePeakDisplay = editList.limiter.enabled
    ? `${editList.limiter.ceilingDb} dBTP`
    : editList.loudnorm.enabled
      ? `${editList.loudnorm.targetTp} dBTP`
      : '—'

  const ruler = useMemo(() => {
    const ticks: number[] = []
    for (let i = 0; i <= 6; i++) {
      ticks.push((viewStart + (i / 6) * span) * editList.sourceDuration)
    }
    return ticks
  }, [viewStart, span, editList.sourceDuration])

  return (
    <div className="pro-editor-shell">
      {/* ---- Top bar ---- */}
      <header className="pro-editor-topbar">
        <div className="pro-editor-topbar__left">
          <div className="pro-editor-topbar__title-row">
            <Link href="/dashboard" className="pro-editor-exit">
              ← Archive
            </Link>
            <h1 className="pro-editor-title">{title}</h1>
            <span className="pro-editor-meta">{formatDuration(editList.sourceDuration)}</span>
          </div>
          <span className="pro-editor-subline">
            edit list: {editList.cuts.length + editList.fades.length} operations · original
            preserved
            {autosaveLabel
              ? ` · saved ${autosaveLabel}`
              : draftUpdatedAt
                ? ` · loaded ${new Date(draftUpdatedAt).toLocaleTimeString()}`
                : ''}
          </span>
        </div>
        <div className="pro-editor-topbar__right">
          {saveError && (
            <span className="studio-text-error">
              {saveError}
              {!draftConflict && (
                <button
                  type="button"
                  className="studio-btn-ghost studio-btn-sm"
                  style={{ marginLeft: 8 }}
                  onClick={() => void flushDraftSave()}
                >
                  Retry save
                </button>
              )}
            </span>
          )}
          {draftConflict && (
            <button
              type="button"
              className="studio-btn-ghost studio-btn-sm"
              onClick={() => window.location.reload()}
            >
              Reload draft
            </button>
          )}
          {exportSuccess && (
            <span className="pro-editor-export-success">
              Version {exportSuccess.versionNumber} ready —{' '}
              <Link href="/dashboard">view in archive</Link>
            </span>
          )}
          <span
            className={cx(
              'pro-editor-pill',
              browserRender ? 'pro-editor-pill--green' : 'pro-editor-pill--amber',
            )}
          >
            ⚙ {renderModePill}
          </span>
          <button type="button" className="studio-btn-ghost" onClick={() => void flushDraftSave()}>
            Save draft
          </button>
          <button
            type="button"
            className="studio-btn-primary"
            onClick={() => setExportDialogOpen(true)}
          >
            Export &amp; publish →
          </button>
        </div>
      </header>

      <nav className="pro-editor-tabs" aria-label="Editor sections" role="tablist">
        <button
          type="button"
          role="tab"
          className={cx('pro-editor-tab', activeTab === 'waveform' && 'pro-editor-tab--active')}
          aria-selected={activeTab === 'waveform'}
          onClick={() => setActiveTab('waveform')}
        >
          Waveform
        </button>
        <button
          type="button"
          role="tab"
          className={cx('pro-editor-tab', activeTab === 'tracklist' && 'pro-editor-tab--active')}
          aria-selected={activeTab === 'tracklist'}
          onClick={() => setActiveTab('tracklist')}
        >
          Tracklist
          {tracklist?.length ? ` (${tracklist.length})` : ''}
        </button>
      </nav>

      {activeTab === 'tracklist' ? (
        <section className="pro-editor-tracklist-panel" aria-label="Tracklist">
          <TracklistEditor value={tracklist} onChange={setTracklist} disabled={tracklistSaving} />
          {remappedTracklist.length > 0 && (
            <div className="pro-editor-tracklist-preview">
              <h3 className="pro-editor-tracklist-preview__title">After cuts (preview)</h3>
              <ol className="pro-editor-tracklist-preview__list">
                {remappedTracklist.map((row, i) => (
                  <li key={`${row.startSec}-${i}`}>
                    <span>{formatDurationDecimal(row.startSec)}</span>
                    <span>{row.title}</span>
                    {row.artistUsername && <span>@{row.artistUsername}</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {tracklistError && <p className="studio-text-error">{tracklistError}</p>}
          <button
            type="button"
            className="studio-btn-primary"
            disabled={tracklistSaving}
            onClick={() => void saveTracklist()}
          >
            {tracklistSaving ? 'Saving…' : 'Save tracklist'}
          </button>
        </section>
      ) : (
        <>
          {/* ---- Toolbar ---- */}
          <div className="pro-editor-toolbar">
            <div className="pro-editor-tool-group" role="group" aria-label="Edit tools">
              {(
                [
                  ['select', '↖', 'Select'],
                  ['cut', '✂', 'Cut'],
                  ['fade', '◢', 'Fade'],
                  ['marker', '◆', 'Marker'],
                ] as const
              ).map(([id, glyph, name]) => (
                <button
                  key={id}
                  type="button"
                  className={cx(
                    'pro-editor-tool-btn',
                    activeTool === id && 'pro-editor-tool-btn--active',
                  )}
                  aria-pressed={activeTool === id}
                  title={name}
                  onClick={() => setActiveTool(id)}
                >
                  {glyph}
                </button>
              ))}
            </div>

            <div className="pro-editor-toolbar-divider" />

            <div className="pro-editor-zoom-group">
              <button
                type="button"
                className="pro-editor-tool-btn"
                onClick={() => setSpan(span * 0.8)}
              >
                −
              </button>
              <input
                type="range"
                className="pro-editor-zoom-slider"
                min={0}
                max={1000}
                value={zoomSliderValue}
                onChange={(e) => setSpan(10 ** ((-3 * Number(e.target.value)) / 1000))}
                aria-label="Zoom"
              />
              <button
                type="button"
                className="pro-editor-tool-btn"
                onClick={() => setSpan(span * 1.25)}
              >
                +
              </button>
              <span className="pro-editor-zoom-ratio">1 px = {msPerPx.toFixed(0)} ms</span>
              <button
                type="button"
                className="studio-btn-ghost"
                onClick={() => {
                  setViewStart(0)
                  setViewEnd(1)
                }}
              >
                Fit
              </button>
              <button
                type="button"
                className="studio-btn-ghost"
                disabled={!selection}
                onClick={() => {
                  if (!selection) return
                  setViewStart(Math.max(0, selection.start / editList.sourceDuration))
                  setViewEnd(Math.min(1, selection.end / editList.sourceDuration))
                }}
              >
                Sel
              </button>
            </div>

            <div className="pro-editor-toolbar-divider" />

            <div className="pro-editor-undo-group">
              <button
                type="button"
                className="pro-editor-tool-btn"
                onClick={undo}
                disabled={!past.length}
              >
                ↶
              </button>
              <button
                type="button"
                className="pro-editor-tool-btn"
                onClick={redo}
                disabled={!future.length}
              >
                ↷
              </button>
              <button
                type="button"
                className={cx('pro-editor-snap', snapEnabled && 'pro-editor-snap--on')}
                onClick={() => setSnapEnabled((s) => !s)}
              >
                snap {snapEnabled ? 'on' : 'off'}
              </button>
            </div>

            <div className="pro-editor-toolbar-spacer" />

            <div className="pro-editor-shortcut-hints">
              <span>space play/pause</span>
              <span>x cut</span>
              <span>⌘z undo</span>
            </div>
          </div>

          {activeTab === 'waveform' &&
            peaks?.silenceRegionsSec &&
            peaks.silenceRegionsSec.length > 0 && (
              <div className="pro-editor-silence-row" aria-label="Silence regions">
                {peaks.silenceRegionsSec.map((region, i) => (
                  <button
                    key={`${region.start}-${i}`}
                    type="button"
                    className="pro-editor-silence-chip"
                    onClick={() => seekToSec(region.start)}
                  >
                    silence · {formatDurationDecimal(region.start)}
                  </button>
                ))}
              </div>
            )}

          {/* ---- Timeline ruler ---- */}
          <div className="pro-editor-ruler">
            {ruler.map((sec, i) => (
              <span key={i}>{formatDuration(sec)}</span>
            ))}
          </div>

          {/* ---- Waveform ---- */}
          <section className="pro-editor-wave" aria-label="Waveform">
            {peaksLoading && <p className="pro-editor-hint">Generating waveform peaks…</p>}
            <div className="pro-editor-wave-panel" ref={wavePanelRef}>
              <div className="pro-editor-canvas-stack">
                <canvas
                  ref={waveRef}
                  className="pro-editor-canvas"
                  width={canvasWidth}
                  height={WAVE_HEIGHT}
                />
                <canvas
                  ref={overlayRef}
                  className="pro-editor-canvas pro-editor-canvas--overlay"
                  width={canvasWidth}
                  height={WAVE_HEIGHT}
                  onPointerDown={(e) => {
                    if (!peaks) return
                    e.currentTarget.setPointerCapture(e.pointerId)
                    const rect = e.currentTarget.getBoundingClientRect()
                    const sec = snapSec(secFromCanvasEvent(e.clientX, rect))
                    if (activeTool === 'marker') {
                      seekToSec(sec)
                      return
                    }
                    setSelection({ start: sec, end: sec })
                  }}
                  onPointerMove={(e) => {
                    if (!peaks || !selection || !(e.buttons & 1)) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const sec = snapSec(secFromCanvasEvent(e.clientX, rect))
                    setSelection({
                      start: Math.min(selection.start, sec),
                      end: Math.max(selection.start, sec),
                    })
                  }}
                  onPointerUp={(e) => {
                    e.currentTarget.releasePointerCapture(e.pointerId)
                    if (!selection || selection.end - selection.start <= 0) return
                    if (activeTool === 'cut') removeSelection()
                    else if (activeTool === 'fade') applyFadeAtSelection()
                    else {
                      const final = snappedSelection()
                      if (final && final !== selection) setSelection(final)
                    }
                  }}
                  onWheel={(e) => {
                    if (!peaks) return
                    e.preventDefault()
                    const rect = e.currentTarget.getBoundingClientRect()
                    const cursorFrac = (e.clientX - rect.left) / rect.width
                    const zoom = e.deltaY > 0 ? 1.15 : 0.87
                    const newSpan = Math.min(1, Math.max(0.001, span * zoom))
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
              {selection && (
                <div className="pro-editor-selection-pill">
                  SELECTION · {formatDurationDecimal(selection.end - selection.start)}
                </div>
              )}
            </div>
            <audio
              ref={audioRef}
              className="pro-editor-audio"
              crossOrigin="anonymous"
              preload="auto"
            />
          </section>

          {/* ---- Minimap ---- */}
          <div className="pro-editor-wave" style={{ paddingTop: 0 }}>
            <div
              className="pro-editor-minimap"
              aria-label="Overview — click to seek"
              onPointerDown={(e) => {
                if (!peaks) return
                const rect = e.currentTarget.getBoundingClientRect()
                const frac = (e.clientX - rect.left) / rect.width
                seekToSec(peaks.durationSec * frac)
              }}
            >
              <canvas
                ref={minimapRef}
                className="pro-editor-canvas"
                width={canvasWidth}
                height={MINIMAP_HEIGHT}
              />
              <div
                className="pro-editor-minimap__viewport"
                style={{ left: `${viewStart * 100}%`, width: `${Math.max(0.5, span * 100)}%` }}
              />
            </div>
            <div className="pro-editor-minimap__endpoints">
              <span>0:00</span>
              <span>{formatDuration(editList.sourceDuration)}</span>
            </div>
          </div>

          {/* ---- Transport ---- */}
          <div className="pro-editor-transport">
            <button
              type="button"
              className="pro-editor-play-btn"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={() => {
                const audio = audioRef.current
                if (!audio) return
                if (audio.paused) void audio.play()
                else audio.pause()
              }}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <span className="pro-editor-time">{formatDuration(currentTime)}</span>
            <span className="pro-editor-time-total">/ {formatDuration(postDuration)}</span>
            <span className="pro-editor-preview-note">
              preview is approximate · render for final result
            </span>
            <div className="pro-editor-transport-right">
              <div className="pro-editor-out-meter">
                <div className="pro-editor-out-meter__tp" style={{ left: '85%' }} />
                <div
                  className="pro-editor-out-meter__fill"
                  style={{ transform: `scaleX(${Math.max(0, 1 - meterPeak)})` }}
                />
              </div>
              <span className="pro-editor-out-readout">
                {meterPeak > 0 ? `${(20 * Math.log10(meterPeak)).toFixed(1)} dB` : '−∞'}
              </span>
            </div>
          </div>
        </>
      )}

      {activeTab === 'waveform' && (
        <div className="pro-editor-bottom">
          {/* Focused plugin panel */}
          <div>
            {focusedPlugin === 'gain' && (
              <div className="pro-editor-panel">
                <div className="pro-editor-panel__header">
                  <div className="pro-editor-panel__heading">
                    <h2 className="pro-editor-panel__title">Gain &amp; Normalize</h2>
                    <span className="pro-editor-panel__pill">IN CHAIN · POSITION 1</span>
                  </div>
                  <div className="pro-editor-panel__actions">
                    <button
                      type="button"
                      className="studio-btn-ghost studio-btn-sm"
                      onClick={() =>
                        pushHistory({
                          ...editList,
                          gainDb: 0,
                          loudnorm: { enabled: false, targetLufs: -14, targetTp: -1.5 },
                        })
                      }
                    >
                      Reset
                    </button>
                    <Switch
                      checked={editList.loudnorm.enabled}
                      onChange={(v) =>
                        pushHistory({ ...editList, loudnorm: { ...editList.loudnorm, enabled: v } })
                      }
                      label="Loudness normalize enabled"
                    />
                  </div>
                </div>
                <div className="pro-editor-panel__body" onPointerDown={beginKnobDrag}>
                  <Knob
                    label="Gain"
                    value={editList.gainDb}
                    min={-12}
                    max={12}
                    step={0.1}
                    unit=" dB"
                    color="var(--cyan)"
                    defaultValue={0}
                    onChange={(v) => pushHistory({ ...editList, gainDb: v })}
                  />
                  <div className="pro-editor-norm-block">
                    <label className="pro-editor-norm-row pro-editor-norm-row--target">
                      <span>Target</span>
                      <select
                        value={editList.loudnorm.targetLufs}
                        onChange={(e) =>
                          pushHistory({
                            ...editList,
                            loudnorm: {
                              ...editList.loudnorm,
                              targetLufs: Number(e.target.value),
                              measured: undefined,
                            },
                          })
                        }
                      >
                        <option value={-14}>−14 LUFS (streaming)</option>
                        <option value={-16}>−16 LUFS</option>
                        <option value={-23}>−23 LUFS (EBU)</option>
                        {![-14, -16, -23].includes(editList.loudnorm.targetLufs) && (
                          <option value={editList.loudnorm.targetLufs}>
                            {editList.loudnorm.targetLufs} LUFS (custom)
                          </option>
                        )}
                      </select>
                    </label>
                    <div className="pro-editor-norm-row">
                      <span>Measured</span>
                      {editList.loudnorm.measured ? (
                        <span>{editList.loudnorm.measured.i.toFixed(1)} LUFS</span>
                      ) : (
                        <button
                          type="button"
                          className="studio-btn-ghost studio-btn-sm"
                          disabled={!ffmpeg || ffmpegLoading || measuring}
                          onClick={() => void handleMeasure()}
                        >
                          {measuring ? 'Measuring…' : 'Measure'}
                        </button>
                      )}
                    </div>
                    <div className="pro-editor-norm-row pro-editor-norm-row--applied">
                      <span>Applied</span>
                      <span>{appliedDb !== null ? dbReadout(appliedDb) : '—'}</span>
                    </div>
                    <button
                      type="button"
                      className="studio-btn-secondary"
                      disabled={!ffmpeg || ffmpegLoading || measuring}
                      onClick={() => void handleMeasure()}
                    >
                      ⚖ Normalize (loudnorm 2-pass)
                    </button>
                  </div>
                </div>
                <p className="pro-editor-panel__hint">
                  drag knob · double-click value to type · ⌥drag = fine · scroll on knob = step
                </p>
              </div>
            )}

            {focusedPlugin === 'eq' && (
              <div className="pro-editor-panel">
                <div className="pro-editor-panel__header">
                  <div className="pro-editor-panel__heading">
                    <h2 className="pro-editor-panel__title">EQ — 3 band</h2>
                    <span className="pro-editor-panel__pill">IN CHAIN · POSITION 2</span>
                  </div>
                  <div className="pro-editor-panel__actions">
                    <button
                      type="button"
                      className="studio-btn-ghost studio-btn-sm"
                      onClick={() =>
                        pushHistory({
                          ...editList,
                          eq: { ...editList.eq, bands: DEFAULT_EQ_BANDS.map((b) => ({ ...b })) },
                        })
                      }
                    >
                      Reset
                    </button>
                    <Switch
                      checked={editList.eq.enabled}
                      onChange={(v) =>
                        pushHistory({ ...editList, eq: { ...editList.eq, enabled: v } })
                      }
                      label="EQ enabled"
                    />
                  </div>
                </div>
                <EqCurve
                  bands={editList.eq.bands}
                  onChange={(i, next) => {
                    const bands = editList.eq.bands.map((b, j) => (j === i ? { ...b, ...next } : b))
                    pushHistory({ ...editList, eq: { ...editList.eq, bands } })
                  }}
                />
                <div className="pro-editor-eq-bands" onPointerDown={beginKnobDrag}>
                  {editList.eq.bands.map((band, i) => (
                    <div key={i} className="pro-editor-eq-band">
                      <Knob
                        label={`Band ${i + 1}`}
                        value={band.gainDb}
                        min={-24}
                        max={24}
                        step={0.5}
                        unit=" dB"
                        color={EQ_BAND_COLORS[i % EQ_BAND_COLORS.length]}
                        defaultValue={DEFAULT_EQ_BANDS[i]?.gainDb ?? 0}
                        onChange={(v) => {
                          const bands = editList.eq.bands.map((b, j) =>
                            j === i ? { ...b, gainDb: v } : b,
                          )
                          pushHistory({ ...editList, eq: { ...editList.eq, bands } })
                        }}
                      />
                      <span className="pro-editor-eq-band__freq">{band.freq} Hz</span>
                      <span className="pro-editor-eq-band__q">Q {band.q.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
                <p className="pro-editor-panel__hint">
                  drag knob · double-click value to type · ⌥drag = fine · scroll on knob = step ·
                  drag curve dots to set frequency &amp; gain
                </p>
              </div>
            )}

            {focusedPlugin === 'comp' && (
              <div className="pro-editor-panel">
                <div className="pro-editor-panel__header">
                  <div className="pro-editor-panel__heading">
                    <h2 className="pro-editor-panel__title">Compressor</h2>
                    <span className="pro-editor-panel__pill">IN CHAIN · POSITION 3</span>
                  </div>
                  <div className="pro-editor-panel__actions">
                    <button
                      type="button"
                      className="studio-btn-ghost studio-btn-sm"
                      onClick={() => pushHistory({ ...editList, comp: { ...DEFAULT_COMP } })}
                    >
                      Reset
                    </button>
                    <Switch
                      checked={editList.comp.enabled}
                      onChange={(v) =>
                        pushHistory({ ...editList, comp: { ...editList.comp, enabled: v } })
                      }
                      label="Compressor enabled"
                    />
                  </div>
                </div>
                <div className="pro-editor-panel__body">
                  <div className="pro-editor-knob-row" onPointerDown={beginKnobDrag}>
                    <Knob
                      label="Threshold"
                      value={editList.comp.thresholdDb}
                      min={-60}
                      max={0}
                      step={1}
                      unit=" dB"
                      color="var(--cyan)"
                      defaultValue={DEFAULT_COMP.thresholdDb}
                      onChange={(v) =>
                        pushHistory({ ...editList, comp: { ...editList.comp, thresholdDb: v } })
                      }
                    />
                    <Knob
                      label="Ratio"
                      value={editList.comp.ratio}
                      min={1}
                      max={20}
                      step={0.5}
                      unit=":1"
                      color="var(--cyan)"
                      defaultValue={DEFAULT_COMP.ratio}
                      onChange={(v) =>
                        pushHistory({ ...editList, comp: { ...editList.comp, ratio: v } })
                      }
                    />
                    <Knob
                      label="Attack"
                      value={editList.comp.attackMs}
                      min={0.1}
                      max={200}
                      step={0.5}
                      unit=" ms"
                      color="var(--cyan)"
                      defaultValue={DEFAULT_COMP.attackMs}
                      onChange={(v) =>
                        pushHistory({ ...editList, comp: { ...editList.comp, attackMs: v } })
                      }
                    />
                    <Knob
                      label="Release"
                      value={editList.comp.releaseMs}
                      min={10}
                      max={1000}
                      step={5}
                      unit=" ms"
                      color="var(--cyan)"
                      defaultValue={DEFAULT_COMP.releaseMs}
                      onChange={(v) =>
                        pushHistory({ ...editList, comp: { ...editList.comp, releaseMs: v } })
                      }
                    />
                    <Knob
                      label="Makeup"
                      value={editList.comp.makeupDb}
                      min={0}
                      max={12}
                      step={0.5}
                      unit=" dB"
                      color="var(--cyan)"
                      defaultValue={DEFAULT_COMP.makeupDb}
                      onChange={(v) =>
                        pushHistory({ ...editList, comp: { ...editList.comp, makeupDb: v } })
                      }
                    />
                  </div>
                  <div className="pro-editor-gr-meter">
                    <div className="pro-editor-gr-meter__track">
                      <div
                        className="pro-editor-gr-meter__fill"
                        style={{ height: `${Math.min(100, (grDb / 24) * 100)}%` }}
                      />
                    </div>
                    <span className="pro-editor-gr-meter__label">GR ≈ {grDb.toFixed(1)}</span>
                  </div>
                </div>
                <p className="pro-editor-panel__hint">
                  drag knob · double-click value to type · ⌥drag = fine · scroll on knob = step
                </p>
              </div>
            )}

            {focusedPlugin === 'limiter' && (
              <div className="pro-editor-panel">
                <div className="pro-editor-panel__header">
                  <div className="pro-editor-panel__heading">
                    <h2 className="pro-editor-panel__title">Limiter</h2>
                    <span className="pro-editor-panel__pill">IN CHAIN · POSITION 4</span>
                  </div>
                  <div className="pro-editor-panel__actions">
                    <button
                      type="button"
                      className="studio-btn-ghost studio-btn-sm"
                      onClick={() => pushHistory({ ...editList, limiter: { ...DEFAULT_LIMITER } })}
                    >
                      Reset
                    </button>
                    <Switch
                      checked={editList.limiter.enabled}
                      onChange={(v) =>
                        pushHistory({ ...editList, limiter: { ...editList.limiter, enabled: v } })
                      }
                      label="Limiter enabled"
                    />
                  </div>
                </div>
                <div className="pro-editor-knob-row" onPointerDown={beginKnobDrag}>
                  <Knob
                    label="Ceiling"
                    value={editList.limiter.ceilingDb}
                    min={-3}
                    max={0}
                    step={0.1}
                    unit=" dBTP"
                    color="var(--coral)"
                    defaultValue={DEFAULT_LIMITER.ceilingDb}
                    onChange={(v) =>
                      pushHistory({ ...editList, limiter: { ...editList.limiter, ceilingDb: v } })
                    }
                  />
                  <Knob
                    label="Release"
                    value={editList.limiter.releaseMs}
                    min={1}
                    max={1000}
                    step={1}
                    unit=" ms"
                    color="var(--cyan)"
                    defaultValue={DEFAULT_LIMITER.releaseMs}
                    onChange={(v) =>
                      pushHistory({ ...editList, limiter: { ...editList.limiter, releaseMs: v } })
                    }
                  />
                </div>
                <p className="pro-editor-panel__hint">
                  applied before loudnorm · protects true peak
                </p>
              </div>
            )}
          </div>

          {/* Plugin chain rail + export */}
          <aside className="pro-editor-rail" aria-label="Plugin chain">
            <div className="pro-editor-rail__header">
              <span>PLUGIN CHAIN</span>
              <span>signal ↓</span>
            </div>
            <div className="pro-editor-rail__list">
              <PlugItem
                position={1}
                name="Gain & Normalize"
                summary={gainSummary}
                enabled={editList.loudnorm.enabled}
                focused={focusedPlugin === 'gain'}
                onFocus={() => focusPlugin('gain')}
                onToggle={(v) =>
                  pushHistory({ ...editList, loudnorm: { ...editList.loudnorm, enabled: v } })
                }
              />
              <PlugItem
                position={2}
                name="EQ"
                summary={eqSummary}
                enabled={editList.eq.enabled}
                focused={focusedPlugin === 'eq'}
                onFocus={() => focusPlugin('eq')}
                onToggle={(v) => pushHistory({ ...editList, eq: { ...editList.eq, enabled: v } })}
              />
              <PlugItem
                position={3}
                name="Compressor"
                summary={compSummary}
                enabled={editList.comp.enabled}
                focused={focusedPlugin === 'comp'}
                onFocus={() => focusPlugin('comp')}
                onToggle={(v) =>
                  pushHistory({ ...editList, comp: { ...editList.comp, enabled: v } })
                }
              />
              <PlugItem
                position={4}
                name="Limiter"
                summary={limiterSummary}
                enabled={editList.limiter.enabled}
                focused={focusedPlugin === 'limiter'}
                onFocus={() => focusPlugin('limiter')}
                onToggle={(v) =>
                  pushHistory({ ...editList, limiter: { ...editList.limiter, enabled: v } })
                }
              />
            </div>

            <button
              type="button"
              className="pro-editor-export-card"
              onClick={() => setExportDialogOpen(true)}
            >
              <div className="pro-editor-export-card__head">
                <span>EXPORT</span>
                <span className="pro-editor-pill pro-editor-pill--green">LOCAL</span>
              </div>
              <div
                className={cx(
                  'pro-editor-export-card__row',
                  editList.loudnorm.enabled && 'pro-editor-export-card__row--ok',
                )}
              >
                <span>Integrated</span>
                <span>{integratedDisplay}</span>
              </div>
              <div
                className={cx(
                  'pro-editor-export-card__row',
                  editList.limiter.enabled && 'pro-editor-export-card__row--ok',
                )}
              >
                <span>True peak</span>
                <span>{truePeakDisplay}</span>
              </div>
              <div className="pro-editor-export-card__row">
                <span>Duration</span>
                <span>{formatDuration(postDuration)}</span>
              </div>
              <div className="pro-editor-export-card__pills">
                <button
                  type="button"
                  className={cx(
                    'pro-editor-format-pill',
                    exportFormat === 'flac' && 'pro-editor-format-pill--active',
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    setExportFormat('flac')
                  }}
                >
                  FLAC 24/96
                </button>
                <button
                  type="button"
                  className={cx(
                    'pro-editor-format-pill',
                    exportFormat === 'mp3' && 'pro-editor-format-pill--active',
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    setExportFormat('mp3')
                  }}
                >
                  MP3 320
                </button>
              </div>
              <div className="pro-editor-export-card__footer">
                renders on your CPU · original kept
                {ffmpegLoading ? ' · loading ffmpeg…' : ''}
                {!isolated && ' · single-thread'}
              </div>
            </button>
          </aside>
        </div>
      )}

      {/* ---- Export dialog ---- */}
      {exportDialogOpen && (
        <div className="pro-editor-dialog-backdrop" onClick={() => setExportDialogOpen(false)}>
          <div className="pro-editor-dialog" onClick={(e) => e.stopPropagation()} role="dialog">
            <h2 className="pro-editor-dialog__title">Export &amp; publish</h2>
            <div className="pro-editor-export-card__pills">
              <button
                type="button"
                className={cx(
                  'pro-editor-format-pill',
                  exportFormat === 'flac' && 'pro-editor-format-pill--active',
                )}
                onClick={() => setExportFormat('flac')}
              >
                FLAC 24/96
              </button>
              <button
                type="button"
                className={cx(
                  'pro-editor-format-pill',
                  exportFormat === 'mp3' && 'pro-editor-format-pill--active',
                )}
                onClick={() => setExportFormat('mp3')}
              >
                MP3 320
              </button>
            </div>
            <p className="pro-editor-panel__hint" style={{ margin: 0 }}>
              {browserRender
                ? `Renders on your CPU via ffmpeg.wasm${!isolated ? ' (single-thread)' : ''}. Original kept.`
                : 'This export is large — it renders on the server worker. Original kept.'}
            </p>
            {exportProgress !== null && (
              <div className="pro-editor-progress">
                <div
                  className="pro-editor-progress__bar"
                  style={{ width: `${exportProgress * 100}%` }}
                />
              </div>
            )}
            {exportPhase && exportProgress !== null && (
              <p className="pro-editor-panel__hint" style={{ margin: 0 }}>
                {exportPhase}
                {exportPhase === 'segment' ? '…' : ''}
              </p>
            )}
            {exportError && <p className="studio-text-error">{exportError}</p>}
            {previewError && <p className="studio-text-error">{previewError}</p>}
            <div className="pro-editor-dialog__actions">
              <button
                type="button"
                className="studio-btn-ghost"
                disabled={
                  previewLoading ||
                  exportProgress !== null ||
                  (browserRender && (!ffmpeg || ffmpegLoading))
                }
                onClick={() => void handlePreviewSample()}
              >
                {previewLoading ? 'Rendering preview…' : 'Preview 30s MP3'}
              </button>
              <button
                type="button"
                className="studio-btn-ghost"
                onClick={() => setExportDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="studio-btn-primary"
                disabled={exportProgress !== null || (browserRender && (!ffmpeg || ffmpegLoading))}
                onClick={() => void handleExport(exportFormat)}
              >
                {browserRender
                  ? `Export ${exportFormat.toUpperCase()}`
                  : `Export ${exportFormat.toUpperCase()} (server)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
