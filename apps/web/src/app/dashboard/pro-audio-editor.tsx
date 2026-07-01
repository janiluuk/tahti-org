// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ButtonIcon } from '@tahti/ui'
import type {
  EditList,
  EditListV2,
  HistoryState,
  OutputFormat,
  PeaksPyramid,
} from '@tahti/audio-edit'
import {
  postCutDuration,
  computeKeepSegments,
  mergeCuts,
  remapTracklistTimestamps,
  shouldRenderInBrowser,
  snapToNearestZeroCrossing,
  History,
  migrateV1toV2,
  gainChainSummary,
  eqChainSummary,
  compChainSummary,
  limiterChainSummary,
  DEFAULT_GAIN_PARAMS,
  DEFAULT_EQ_PARAMS,
  DEFAULT_COMP_PARAMS,
  DEFAULT_LIMITER_PARAMS,
} from '@tahti/audio-edit'
import type { GainParams } from '@tahti/audio-edit'
import type { EqParams } from '@tahti/audio-edit'
import type { CompParams } from '@tahti/audio-edit'
import type { LimiterParams } from '@tahti/audio-edit'
import { GainPanel } from '@/lib/audio-editor/panels/GainPanel'
import { EqPanel } from '@/lib/audio-editor/panels/EqPanel'
import { CompPanel } from '@/lib/audio-editor/panels/CompPanel'
import { LimiterPanel } from '@/lib/audio-editor/panels/LimiterPanel'
import type { TracklistEntry } from '@tahti/shared'
import type { FFmpeg } from '@ffmpeg/ffmpeg'
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
  readPeakLevel,
} from '@/lib/audio-editor/preview-audio'
import {
  drawMinimapLayer,
  drawOverlayLayer,
  drawWaveformLayer,
} from '@/lib/audio-editor/waveform-draw'
import { waitForRenderViaProgress } from '@/lib/audio-editor/render-progress'

const AUTOSAVE_MS = 2000
const AUTOSAVE_KNOB_MS = 6000
const CANVAS_MIN_WIDTH = 320
const CANVAS_DEFAULT_WIDTH = 1280
const WAVE_HEIGHT = 340
const MINIMAP_HEIGHT = 38

type EditorTab = 'waveform' | 'tracklist'
type ToolId = 'select' | 'cut' | 'fade' | 'marker'

/** Convert EditListV2 → EditList v1 for audio pipeline boundaries. */
function v2ToV1(v2: EditListV2): EditList {
  const gainP = v2.plugins.find((p) => p.pluginId === 'gain')
  const eqP = v2.plugins.find((p) => p.pluginId === 'eq')
  const compP = v2.plugins.find((p) => p.pluginId === 'comp')
  const limP = v2.plugins.find((p) => p.pluginId === 'limiter')
  const gp = gainP?.params as GainParams | undefined
  const ep = eqP?.params as EqParams | undefined
  const cp = compP?.params as CompParams | undefined
  const lp = limP?.params as LimiterParams | undefined
  return {
    version: 1 as const,
    sourceDuration: v2.sourceDuration,
    gainDb: gp?.db ?? 0,
    highPassHz: 0,
    lowPassHz: 0,
    loudnorm: {
      enabled: gainP?.enabled !== false && (gp?.normalize.enabled ?? false),
      targetLufs: gp?.normalize.targetLufs ?? -14,
      targetTp: gp?.normalize.targetTp ?? -1.5,
      measured: gp?.measured,
    },
    eq: {
      enabled: eqP?.enabled ?? false,
      bands: (ep?.bands ?? DEFAULT_EQ_PARAMS.bands).map((b) => ({
        freq: b.freq,
        gainDb: b.gainDb,
        q: b.q,
      })),
    },
    comp: {
      enabled: compP?.enabled ?? false,
      thresholdDb: cp?.thresholdDb ?? DEFAULT_COMP_PARAMS.thresholdDb,
      ratio: cp?.ratio ?? DEFAULT_COMP_PARAMS.ratio,
      attackMs: cp?.attackMs ?? DEFAULT_COMP_PARAMS.attackMs,
      releaseMs: cp?.releaseMs ?? DEFAULT_COMP_PARAMS.releaseMs,
      makeupDb: cp?.makeupDb ?? DEFAULT_COMP_PARAMS.makeupDb,
    },
    limiter: {
      enabled: limP?.enabled ?? false,
      ceilingDb: lp?.ceilingDb ?? DEFAULT_LIMITER_PARAMS.ceilingDb,
      releaseMs: lp?.releaseMs ?? DEFAULT_LIMITER_PARAMS.releaseMs,
    },
    cuts: v2.cuts.map((c) => ({ start: c.start, end: c.end })),
    fades: v2.fades.map((f) => ({ type: f.type, at: f.at, duration: f.duration, curve: f.curve })),
  }
}

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

function ChainTile({
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
  onToggle: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      className={cx('plug', focused && 'plug--focused', !enabled && 'plug--bypassed')}
      onClick={onFocus}
    >
      <div className="plug__head">
        <span className="plug__name">
          {position} · {name}
        </span>
        <Switch checked={enabled} onChange={onToggle} label={`${name} enabled`} />
      </div>
      <div className="plug__summary plug__mono-summary">{summary}</div>
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
  // Migrate v1→v2 once at mount; keep instance IDs stable via ref
  const initialV2Ref = useRef(migrateV1toV2(initialEditList))

  const [historyState, setHistoryState] = useState<HistoryState>(() =>
    History.empty(initialV2Ref.current),
  )
  const editList = History.current(historyState).editList
  const editListRef = useRef(editList)
  editListRef.current = editList

  const [focusedInstanceId, setFocusedInstanceId] = useState<string>(
    () => initialV2Ref.current.plugins[0]!.instanceId,
  )

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
  const [viewStart, setViewStart] = useState(0)
  const [viewEnd, setViewEnd] = useState(1)
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)
  const [activeTool, setActiveTool] = useState<ToolId>('select')
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [measuring, setMeasuring] = useState(false)
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
  const previewRef = useRef<ReturnType<typeof attachPreviewGraph> | null>(null)
  const previewSourceRef = useRef<ReturnType<typeof createPreviewSource> | null>(null)

  // ---- Plugin helpers ----
  const pushEdit = useCallback((next: EditListV2, label = 'Edit') => {
    setHistoryState((s) => History.push(s, next, label))
  }, [])

  const undo = useCallback(() => {
    setHistoryState((s) => (History.canUndo(s) ? History.undo(s) : s))
  }, [])

  const redo = useCallback(() => {
    setHistoryState((s) => (History.canRedo(s) ? History.redo(s) : s))
  }, [])

  const patchPlugin = useCallback((instanceId: string, params: unknown) => {
    setHistoryState((s) => {
      const cur = History.current(s).editList
      const next: EditListV2 = {
        ...cur,
        plugins: cur.plugins.map((p) => (p.instanceId === instanceId ? { ...p, params } : p)),
      }
      return History.push(s, next, 'Plugin param')
    })
  }, [])

  const togglePlugin = useCallback((instanceId: string, enabled: boolean) => {
    setHistoryState((s) => {
      const cur = History.current(s).editList
      const next: EditListV2 = {
        ...cur,
        plugins: cur.plugins.map((p) => (p.instanceId === instanceId ? { ...p, enabled } : p)),
      }
      return History.push(s, next, enabled ? 'Enable plugin' : 'Bypass plugin')
    })
  }, [])

  const flushDraftSave = useCallback(async () => {
    autosavePendingRef.current = true
    const v1 = v2ToV1(editListRef.current)
    const res = await saveArchiveEditListDraft(archiveId, v1, draftUpdatedAtRef.current)
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
    setIsolated(typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated)
  }, [])

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
      // Note: AudioContext intentionally not closed — createMediaElementSource can only be
      // called once per element; the source is cached per element across StrictMode cycles.
      previewRef.current?.disconnect()
      previewRef.current = null
      previewSourceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create once per mount
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    const source = previewSourceRef.current
    if (!audio || !source) return
    previewRef.current?.disconnect()
    previewRef.current = attachPreviewGraph(source, audio, v2ToV1(editList))
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

  const editListV1 = useMemo(() => v2ToV1(editList), [editList])
  const browserRender = useMemo(
    () => shouldRenderInBrowser(editListV1, sourceFileSizeBytes),
    [editListV1, sourceFileSizeBytes],
  )

  const renderModePill = browserRender
    ? ffmpegLoading
      ? 'Loading ffmpeg…'
      : `LOCAL · ffmpeg.wasm${!isolated ? ' · 1 thread' : ''}`
    : 'Server worker render'

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
    () => (tracklist?.length ? remapTracklistTimestamps(tracklist, editListV1) : []),
    [tracklist, editListV1],
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
    pushEdit(
      {
        ...editList,
        cuts: [...editList.cuts, { id: crypto.randomUUID(), start: final.start, end: final.end }],
      },
      'Cut',
    )
    setSelection(null)
  }, [editList, pushEdit, snappedSelection])

  const applyFadeAtSelection = useCallback(() => {
    const final = snappedSelection()
    if (!final) return
    const dur = Math.max(0.05, Math.min(5, final.end - final.start))
    pushEdit(
      {
        ...editList,
        fades: [
          ...editList.fades,
          {
            id: crypto.randomUUID(),
            type: 'in' as const,
            at: final.start,
            duration: dur,
            curve: 'tri' as const,
          },
          {
            id: crypto.randomUUID(),
            type: 'out' as const,
            at: Math.max(final.start, final.end - dur),
            duration: dur,
            curve: 'tri' as const,
          },
        ],
      },
      'Fade',
    )
    setSelection(null)
  }, [editList, pushEdit, snappedSelection])

  async function handleMeasure() {
    if (!ffmpeg || !inputPathRef.current) return
    setMeasuring(true)
    try {
      const gainPlugin = editList.plugins.find((p) => p.pluginId === 'gain')
      if (!gainPlugin) return
      const gp = gainPlugin.params as GainParams
      const enabledParams: GainParams = gp.normalize.enabled
        ? gp
        : { ...gp, normalize: { ...gp.normalize, enabled: true } }

      const v1 = v2ToV1({
        ...editList,
        plugins: editList.plugins.map((p) =>
          p.instanceId === gainPlugin.instanceId ? { ...p, params: enabledParams } : p,
        ),
      })
      const measured = await measureLoudnorm(ffmpeg, v1, inputPathRef.current)
      if (measured) {
        pushEdit(
          {
            ...editList,
            plugins: editList.plugins.map((p) =>
              p.instanceId === gainPlugin.instanceId
                ? { ...p, params: { ...enabledParams, measured } }
                : p,
            ),
          },
          'Measure loudness',
        )
      }
    } finally {
      setMeasuring(false)
    }
  }

  async function handlePreviewSample() {
    setPreviewError(null)
    setPreviewLoading(true)
    try {
      const v1 = v2ToV1(editList)
      if (browserRender && ffmpeg && inputPathRef.current) {
        const out = await renderEditToFile(ffmpeg, v1, inputPathRef.current, 'mp3', undefined, {
          maxDurationSec: 30,
        })
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
        editList: v1,
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
    const v1 = v2ToV1(editList)

    try {
      if (!browserRender) {
        const res = await renderArchiveEditList(archiveId, {
          editList: v1,
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

      let list = v1
      if (list.loudnorm.enabled && !list.loudnorm.measured) {
        const measured = await measureLoudnorm(ffmpeg, list, inputPathRef.current)
        if (measured) {
          // reflect measured back into v2 and re-derive v1
          const gainPlugin = editList.plugins.find((p) => p.pluginId === 'gain')!
          const updated: EditListV2 = {
            ...editList,
            plugins: editList.plugins.map((p) =>
              p.instanceId === gainPlugin.instanceId
                ? { ...p, params: { ...(gainPlugin.params as GainParams), measured } }
                : p,
            ),
          }
          setHistoryState((s) => History.push(s, updated, 'Measure for export'))
          list = v2ToV1(updated)
        }
      }

      const out = await renderEditToFile(ffmpeg, list, inputPathRef.current, format)
      const contentType =
        format === 'mp3' ? 'audio/mpeg' : format === 'wav' ? 'audio/wav' : 'audio/flac'
      const filename = `edit.${format}`
      const bytes = new Uint8Array(out)
      const blob = new Blob([bytes], { type: contentType })
      const prep = await prepareArchiveVersionUpload(archiveId, { filename, contentType })
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

  const ruler = useMemo(() => {
    const ticks: number[] = []
    for (let i = 0; i <= 6; i++) {
      ticks.push((viewStart + (i / 6) * span) * editList.sourceDuration)
    }
    return ticks
  }, [viewStart, span, editList.sourceDuration])

  // ---- Derived plugin values ----
  const gainPlugin = editList.plugins.find((p) => p.pluginId === 'gain')
  const eqPlugin = editList.plugins.find((p) => p.pluginId === 'eq')
  const compPlugin = editList.plugins.find((p) => p.pluginId === 'comp')
  const limiterPlugin = editList.plugins.find((p) => p.pluginId === 'limiter')
  const gainParams = gainPlugin?.params as GainParams | undefined
  const eqParams = eqPlugin?.params as EqParams | undefined
  const compParams = compPlugin?.params as CompParams | undefined
  const limiterParams = limiterPlugin?.params as LimiterParams | undefined

  const focusedPlugin =
    editList.plugins.find((p) => p.instanceId === focusedInstanceId) ?? editList.plugins[0]!

  const renderLufs =
    gainPlugin?.enabled && gainParams?.normalize.enabled
      ? `${gainParams.normalize.targetLufs} LUFS`
      : '—'
  const renderTp =
    limiterPlugin?.enabled && limiterParams
      ? `${limiterParams.ceilingDb} dBTP`
      : gainPlugin?.enabled && gainParams?.normalize.enabled
        ? `${gainParams.normalize.targetTp} dBTP`
        : '—'

  const pluginPosition = (instanceId: string) =>
    editList.plugins.findIndex((p) => p.instanceId === instanceId) + 1

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
            <span className="pro-editor-subline">
              {autosaveLabel
                ? `autosaved ${autosaveLabel}`
                : draftUpdatedAt
                  ? `loaded ${new Date(draftUpdatedAt).toLocaleTimeString()}`
                  : ''}
            </span>
          </div>
        </div>
        <div className="pro-editor-topbar__right">
          {saveError && (
            <span className="studio-text-error">
              {saveError}
              {!draftConflict && (
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost ui-btn--sm"
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
              className="ui-btn ui-btn--ghost ui-btn--sm"
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
            ⊙ {renderModePill}
          </span>
          <button
            type="button"
            className="ui-btn ui-btn--primary"
            onClick={() => setExportDialogOpen(true)}
          >
            <ButtonIcon name="download" />
            Export →
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
          Tracklist{tracklist?.length ? ` (${tracklist.length})` : ''}
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
            className="ui-btn ui-btn--primary"
            disabled={tracklistSaving}
            onClick={() => void saveTracklist()}
          >
            <ButtonIcon name="save" />
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
                className="ui-btn ui-btn--ghost ui-btn--sm"
                onClick={() => {
                  setViewStart(0)
                  setViewEnd(1)
                }}
              >
                Fit
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--ghost ui-btn--sm"
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
                disabled={!History.canUndo(historyState)}
              >
                ↶
              </button>
              <button
                type="button"
                className="pro-editor-tool-btn"
                onClick={redo}
                disabled={!History.canRedo(historyState)}
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

          {peaks?.silenceRegionsSec && peaks.silenceRegionsSec.length > 0 && (
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
          <section className="pro-editor-wave" aria-label="Waveform" data-hero>
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
                  SEL · {formatDurationDecimal(selection.end - selection.start)}
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
                {meterPeak > 0 ? `${(20 * Math.log10(meterPeak)).toFixed(1)} dBFS` : '−∞'}
              </span>
            </div>
          </div>

          {/* ---- Plugin chain strip ---- */}
          <div className="pro-editor-chain">
            <div className="pro-editor-chain__header">
              <span>PLUGIN CHAIN · SIGNAL FLOW →</span>
              <span>click to focus · toggle to bypass</span>
            </div>
            <div className="pro-editor-chain__strip">
              {editList.plugins.map((plugin, i) => {
                let summary = ''
                if (plugin.pluginId === 'gain')
                  summary = gainChainSummary(plugin.params as GainParams, plugin.enabled)
                else if (plugin.pluginId === 'eq')
                  summary = eqChainSummary(plugin.params as EqParams, plugin.enabled)
                else if (plugin.pluginId === 'comp')
                  summary = compChainSummary(plugin.params as CompParams, plugin.enabled)
                else if (plugin.pluginId === 'limiter')
                  summary = limiterChainSummary(plugin.params as LimiterParams, plugin.enabled)

                const pluginName =
                  plugin.pluginId === 'gain'
                    ? 'Gain'
                    : plugin.pluginId === 'eq'
                      ? 'EQ'
                      : plugin.pluginId === 'comp'
                        ? 'Comp'
                        : 'Limiter'

                return (
                  <div key={plugin.instanceId} className="pro-editor-chain__cell">
                    {i > 0 && (
                      <span className="pro-editor-chain__arrow" aria-hidden>
                        →
                      </span>
                    )}
                    <div className="pro-editor-chain__tile">
                      <ChainTile
                        position={i + 1}
                        name={pluginName}
                        summary={summary}
                        enabled={plugin.enabled}
                        focused={plugin.instanceId === focusedInstanceId}
                        onFocus={() => setFocusedInstanceId(plugin.instanceId)}
                        onToggle={(v) => togglePlugin(plugin.instanceId, v)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ---- Focused plugin panel ---- */}
          <div className="pro-editor-panel-area">
            <div className="pro-editor-panel">
              <div className="pro-editor-panel__header">
                <div className="pro-editor-panel__heading">
                  <h2 className="pro-editor-panel__title">
                    {focusedPlugin.pluginId === 'gain'
                      ? 'Gain & Normalize'
                      : focusedPlugin.pluginId === 'eq'
                        ? 'EQ — 3 band parametric'
                        : focusedPlugin.pluginId === 'comp'
                          ? 'Compressor'
                          : 'Limiter'}
                  </h2>
                  <span className="pro-editor-panel__pill">
                    POSITION {pluginPosition(focusedPlugin.instanceId)} ·{' '}
                    {focusedPlugin.enabled ? 'ENABLED' : 'BYPASSED'}
                  </span>
                </div>
                <div className="pro-editor-panel__actions">
                  <button
                    type="button"
                    className="ui-btn ui-btn--ghost ui-btn--sm"
                    onClick={() => {
                      const defaults =
                        focusedPlugin.pluginId === 'gain'
                          ? { ...DEFAULT_GAIN_PARAMS }
                          : focusedPlugin.pluginId === 'eq'
                            ? { ...DEFAULT_EQ_PARAMS }
                            : focusedPlugin.pluginId === 'comp'
                              ? { ...DEFAULT_COMP_PARAMS }
                              : { ...DEFAULT_LIMITER_PARAMS }
                      patchPlugin(focusedPlugin.instanceId, defaults)
                    }}
                  >
                    Reset
                  </button>
                  <Switch
                    checked={focusedPlugin.enabled}
                    onChange={(v) => togglePlugin(focusedPlugin.instanceId, v)}
                    label={`${focusedPlugin.pluginId} enabled`}
                  />
                </div>
              </div>
              <div onPointerDown={beginKnobDrag}>
                {focusedPlugin.pluginId === 'gain' && gainPlugin && gainParams && (
                  <GainPanel
                    params={gainParams}
                    onChange={(p) => patchPlugin(gainPlugin.instanceId, p)}
                    measured={gainParams.measured}
                    onMeasure={() => void handleMeasure()}
                    measuring={measuring}
                  />
                )}
                {focusedPlugin.pluginId === 'eq' && eqPlugin && eqParams && (
                  <EqPanel
                    params={eqParams}
                    onChange={(p) => patchPlugin(eqPlugin.instanceId, p)}
                  />
                )}
                {focusedPlugin.pluginId === 'comp' && compPlugin && compParams && (
                  <CompPanel
                    params={compParams}
                    onChange={(p) => patchPlugin(compPlugin.instanceId, p)}
                  />
                )}
                {focusedPlugin.pluginId === 'limiter' && limiterPlugin && limiterParams && (
                  <LimiterPanel
                    params={limiterParams}
                    onChange={(p) => patchPlugin(limiterPlugin.instanceId, p)}
                  />
                )}
              </div>
              <p className="pro-editor-panel__hint">
                drag knob · double-click to type · ⌥drag = fine · scroll = step
              </p>
            </div>
          </div>

          {/* ---- Render summary bar ---- */}
          <div className="pro-editor-render-bar">
            <span className="pro-editor-render-bar__label">WILL RENDER</span>
            <span className="pro-editor-render-bar__values">
              {renderLufs} · {renderTp} · {formatDuration(postDuration)}
            </span>
            <div className="pro-editor-render-bar__pills">
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
          </div>
        </>
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
                className="ui-btn ui-btn--ghost ui-btn--sm"
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
                className="ui-btn ui-btn--ghost ui-btn--sm"
                onClick={() => setExportDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ui-btn ui-btn--primary"
                disabled={exportProgress !== null || (browserRender && (!ffmpeg || ffmpegLoading))}
                onClick={() => void handleExport(exportFormat)}
              >
                <ButtonIcon name="download" />
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
