// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ButtonIcon, Button } from '@tahti/ui'
import type { EditList, HistoryState, OutputFormat, PeaksPyramid } from '@tahti/audio-edit'
import {
  postCutDuration,
  computeKeepSegments,
  mergeCuts,
  remapTracklistTimestamps,
  shouldRenderInBrowser,
  History,
  migrateV1toV2,
} from '@tahti/audio-edit'
import type { GainParams } from '@tahti/audio-edit'
import type { EqParams } from '@tahti/audio-edit'
import type { CompParams } from '@tahti/audio-edit'
import type { LimiterParams } from '@tahti/audio-edit'
import type { FilterParams } from '@tahti/audio-edit'
import { SOUND_CLIP_MAX_DURATION_SEC, type TracklistEntry } from '@tahti/shared'
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { TracklistEditor } from './tracklist-editor'
import {
  generatePeaksFromFfmpeg,
  loadFfmpeg,
  mountSourceFile,
  unmountSource,
} from '@/lib/audio-editor/ffmpeg-client'
import { loadPeaksCache, savePeaksCache } from '@/lib/audio-editor/peaks-cache'
import { formatDuration, formatDurationDecimal } from '@/lib/audio-editor/format'
import { v2ToV1 } from '@/lib/audio-editor/edit-list-convert'
import {
  attachPreviewGraph,
  createPreviewSource,
  readPeakLevel,
} from '@/lib/audio-editor/preview-audio'
import { useDraftAutosave } from '@/lib/audio-editor/use-draft-autosave'
import { useEditHistory } from '@/lib/audio-editor/use-edit-history'
import { useExportAndClip } from '@/lib/audio-editor/use-export-and-clip'
import {
  MINIMAP_HEIGHT,
  useWaveformCanvas,
  WAVE_HEIGHT,
} from '@/lib/audio-editor/use-waveform-canvas'
import { cx } from './pro-audio-editor-controls'
import { ProAudioEditorChain } from './pro-audio-editor-chain'
import { CreateClipDialog, ExportDialog } from './pro-audio-editor-dialogs'
import { ProAudioEditorToolbar } from './pro-audio-editor-toolbar'
import { ProAudioEditorTransport } from './pro-audio-editor-transport'

type EditorTab = 'waveform' | 'tracklist'
type ToolId = 'select' | 'cut' | 'fade' | 'marker'

export function ProAudioEditor({
  soundId,
  title,
  sourceUrl,
  sourceKey,
  sourceFileSizeBytes,
  initialEditList,
  draftUpdatedAt,
  initialTracklist,
  initialEditorPeaks,
}: {
  soundId: string
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

  const { pushEdit, undo, redo, patchPlugin, togglePlugin } = useEditHistory(setHistoryState)

  const [focusedInstanceId, setFocusedInstanceId] = useState<string>(
    () => initialV2Ref.current.plugins[0]!.instanceId,
  )
  const [pluginsExpanded, setPluginsExpanded] = useState(() =>
    initialV2Ref.current.plugins.some((plugin) => plugin.enabled),
  )
  const [previewMode, setPreviewMode] = useState<'before' | 'after'>('after')
  const [previewBypassedPluginId, setPreviewBypassedPluginId] = useState<string | null>(null)

  const [knobDragging, setKnobDragging] = useState(false)
  const [isolated, setIsolated] = useState(false)
  const [peaks, setPeaks] = useState<PeaksPyramid | null>(null)
  const [peaksLoading, setPeaksLoading] = useState(true)
  const [ffmpeg, setFfmpeg] = useState<FFmpeg | null>(null)
  const [ffmpegLoading, setFfmpegLoading] = useState(true)
  const [ffmpegUnavailable, setFfmpegUnavailable] = useState(false)
  const [exportProgress, setExportProgress] = useState<number | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportFormat, setExportFormat] = useState<OutputFormat>('flac')
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [clipDialogOpen, setClipDialogOpen] = useState(false)
  const [clipTitle, setClipTitle] = useState('')
  const [clipStartSec, setClipStartSec] = useState(0)
  const [clipEndSec, setClipEndSec] = useState(Math.min(SOUND_CLIP_MAX_DURATION_SEC, 30))
  const [clipBusy, setClipBusy] = useState(false)
  const [clipError, setClipError] = useState<string | null>(null)
  const [clipSuccess, setClipSuccess] = useState<{ clipId: string; title: string } | null>(null)
  const [exportSuccess, setExportSuccess] = useState<{
    versionNumber: number
    versionLabel: string
  } | null>(null)
  const [meterPeak, setMeterPeak] = useState(0)
  const [activeTool, setActiveTool] = useState<ToolId>('select')
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [measuring, setMeasuring] = useState(false)
  const [activeTab, setActiveTab] = useState<EditorTab>('waveform')
  const [tracklist, setTracklist] = useState<TracklistEntry[] | null>(initialTracklist ?? null)
  const [tracklistError, setTracklistError] = useState<string | null>(null)
  const [tracklistSaving, setTracklistSaving] = useState(false)
  const [exportPhase, setExportPhase] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const {
    wavePanelRef,
    waveRef,
    overlayRef,
    minimapRef,
    audioRef,
    viewStart,
    setViewStart,
    setViewEnd,
    selection,
    setSelection,
    previewingSelection,
    setPreviewingSelection,
    currentTime,
    canvasWidth,
    snapSec,
    setSpan,
    span,
    zoomSliderValue,
    msPerPx,
    snappedSelection,
    secFromCanvasEvent,
    seekToSec,
    handlePreviewSelection,
    ruler,
  } = useWaveformCanvas({
    peaks,
    cuts: editList.cuts,
    sourceDuration: editList.sourceDuration,
    snapEnabled,
  })

  const inputPathRef = useRef<string | null>(null)
  const sourceFileRef = useRef<File | null>(null)
  const sourceBlobUrlRef = useRef<string | null>(null)
  const previewRef = useRef<ReturnType<typeof attachPreviewGraph> | null>(null)
  const previewSourceRef = useRef<ReturnType<typeof createPreviewSource> | null>(null)

  const { autosaveLabel, saveError, draftConflict, flushDraftSave } = useDraftAutosave({
    soundId,
    editList,
    editListRef,
    draftUpdatedAt,
    knobDragging,
    setKnobDragging,
    exportProgress,
  })

  useEffect(() => {
    setIsolated(typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated)
  }, [])

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

        // Peaks display never needs ffmpeg.wasm at all — the worker pre-renders
        // a PeaksPyramid during ingest (or a prior browser session cached one).
        // Check those first so the waveform shows immediately regardless of
        // whether ffmpeg.wasm loads, which browser-support issues (e.g. some
        // Firefox configurations don't expose the SharedArrayBuffer/WASM
        // threading ffmpeg.wasm wants) can otherwise block indefinitely.
        const cached = await loadPeaksCache(soundId, sourceKey)
        if (cached) {
          setPeaks(cached)
          setPeaksLoading(false)
        } else if (initialEditorPeaks?.levels?.length) {
          setPeaks(initialEditorPeaks)
          await savePeaksCache(soundId, sourceKey, initialEditorPeaks)
          setPeaksLoading(false)
        }
        if (cancelled) return

        // ffmpeg.wasm is still needed for in-browser preview render/export and,
        // failing the above, client-side peak generation — but never let a
        // hung load (observed in some Firefox setups) block the editor forever.
        // A timeout gives up cleanly and falls back to server-side rendering
        // instead of leaving the UI stuck on "Loading ffmpeg…".
        const FFMPEG_LOAD_TIMEOUT_MS = 20_000
        const ff = await Promise.race([
          loadFfmpeg((r) => {
            if (exportProgress !== null) setExportProgress(r)
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), FFMPEG_LOAD_TIMEOUT_MS)),
        ])
        if (cancelled) return

        if (!ff) {
          setFfmpegUnavailable(true)
          if (!cached && !initialEditorPeaks?.levels?.length) {
            setSaveError(
              "This browser couldn't load the in-editor audio engine, so the waveform and " +
                "browser-side preview aren't available here — export still works via the " +
                'server. Try Chrome/Edge, or check back shortly if this track was just ' +
                'uploaded (the waveform renders in the background).',
            )
          }
          return
        }
        setFfmpeg(ff)

        const path = await mountSourceFile(ff, file)
        inputPathRef.current = path

        if (!cached && !initialEditorPeaks?.levels?.length) {
          const pyramid = await generatePeaksFromFfmpeg(ff, path, editList.sourceDuration)
          await savePeaksCache(soundId, sourceKey, pyramid)
          if (!cancelled) setPeaks(pyramid)
        }
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
  }, [soundId, sourceKey, sourceUrl])

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
    const previewSourceList = previewBypassedPluginId
      ? {
          ...editList,
          plugins: editList.plugins.map((plugin) =>
            plugin.instanceId === previewBypassedPluginId ? { ...plugin, enabled: false } : plugin,
          ),
        }
      : editList
    const previewEdit = v2ToV1(previewSourceList)
    if (previewMode === 'before') {
      previewEdit.gainDb = 0
      previewEdit.loudnorm.enabled = false
      previewEdit.eq.enabled = false
      previewEdit.comp.enabled = false
      previewEdit.limiter.enabled = false
      previewEdit.filter.enabled = false
    }
    previewRef.current = attachPreviewGraph(source, audio, previewEdit)
    return () => previewRef.current?.disconnect()
  }, [editList, previewMode, previewBypassedPluginId, audioRef])

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
  }, [audioRef])

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

  const segments = useMemo(
    () => computeKeepSegments(editList.sourceDuration, mergeCuts(editList.cuts)),
    [editList],
  )
  const postDuration = useMemo(() => postCutDuration(segments), [segments])

  const editListV1 = useMemo(() => v2ToV1(editList), [editList])
  const browserRender = useMemo(
    () => !ffmpegUnavailable && shouldRenderInBrowser(editListV1, sourceFileSizeBytes),
    [editListV1, sourceFileSizeBytes, ffmpegUnavailable],
  )

  const renderModePill = ffmpegUnavailable
    ? 'Server worker render (browser engine unavailable)'
    : browserRender
      ? ffmpegLoading
        ? 'Loading ffmpeg…'
        : `LOCAL · ffmpeg.wasm${!isolated ? ' · 1 thread' : ''}`
      : 'Server worker render'

  const {
    openClipDialog,
    handleCreateClip,
    saveTracklist,
    handleMeasure,
    handlePreviewSample,
    handleExport,
  } = useExportAndClip({
    soundId,
    title,
    editList,
    browserRender,
    ffmpeg,
    inputPathRef,
    tracklist,
    clipStartSec,
    clipEndSec,
    clipTitle,
    snappedSelection,
    pushEdit,
    setClipStartSec,
    setClipEndSec,
    setClipTitle,
    setClipError,
    setClipSuccess,
    setClipDialogOpen,
    setClipBusy,
    setSelection,
    setTracklistSaving,
    setTracklistError,
    setMeasuring,
    setPreviewError,
    setPreviewLoading,
    setExportProgress,
    setExportPhase,
    setExportError,
    setExportSuccess,
    setExportDialogOpen,
  })

  const remappedTracklist = useMemo(
    () => (tracklist?.length ? remapTracklistTimestamps(tracklist, editListV1) : []),
    [tracklist, editListV1],
  )

  const beginKnobDrag = useCallback(() => setKnobDragging(true), [])

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
  }, [editList, pushEdit, snappedSelection, setSelection])

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
  }, [editList, pushEdit, snappedSelection, setSelection])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.code === 'Space') {
        e.preventDefault()
        const audio = audioRef.current
        if (!audio) return
        if (audio.paused) {
          setPreviewingSelection(false)
          void audio.play()
        } else audio.pause()
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
  }, [
    selection,
    activeTool,
    undo,
    redo,
    removeSelection,
    applyFadeAtSelection,
    audioRef,
    setPreviewingSelection,
    setSelection,
  ])

  useEffect(() => {
    return () => {
      if (ffmpeg) void unmountSource(ffmpeg)
    }
  }, [ffmpeg])

  // ---- Derived plugin values ----
  const gainPlugin = editList.plugins.find((p) => p.pluginId === 'gain')
  const eqPlugin = editList.plugins.find((p) => p.pluginId === 'eq')
  const compPlugin = editList.plugins.find((p) => p.pluginId === 'comp')
  const limiterPlugin = editList.plugins.find((p) => p.pluginId === 'limiter')
  const filterPlugin = editList.plugins.find((p) => p.pluginId === 'filter')
  const gainParams = gainPlugin?.params as GainParams | undefined
  const eqParams = eqPlugin?.params as EqParams | undefined
  const compParams = compPlugin?.params as CompParams | undefined
  const limiterParams = limiterPlugin?.params as LimiterParams | undefined
  const filterParams = filterPlugin?.params as FilterParams | undefined

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

  const handleTogglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      setPreviewingSelection(false)
      void audio.play()
    } else audio.pause()
  }, [audioRef, setPreviewingSelection])

  const handlePreviewModeChange = useCallback((mode: 'before' | 'after') => {
    setPreviewBypassedPluginId(null)
    setPreviewMode(mode)
  }, [])

  return (
    <div className="pro-editor-shell">
      {/* ---- Top bar ---- */}
      <header className="pro-editor-topbar">
        <div className="pro-editor-topbar__left">
          <div className="pro-editor-topbar__title-row">
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
                <Button
                  style={{ marginLeft: 8 }}
                  onClick={() => void flushDraftSave()}
                  variant="ghost"
                  size="sm"
                >
                  Retry save
                </Button>
              )}
            </span>
          )}
          {draftConflict && (
            <Button onClick={() => window.location.reload()} variant="ghost" size="sm">
              Reload draft
            </Button>
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
          <Button disabled={tracklistSaving} onClick={() => void saveTracklist()} variant="primary">
            <ButtonIcon name="save" />
            {tracklistSaving ? 'Saving…' : 'Save tracklist'}
          </Button>
        </section>
      ) : (
        <>
          <ProAudioEditorToolbar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            span={span}
            setSpan={setSpan}
            zoomSliderValue={zoomSliderValue}
            msPerPx={msPerPx}
            setViewStart={setViewStart}
            setViewEnd={setViewEnd}
            setSelection={setSelection}
            selection={selection}
            sourceDuration={editList.sourceDuration}
            undo={undo}
            redo={redo}
            historyState={historyState}
            snapEnabled={snapEnabled}
            setSnapEnabled={setSnapEnabled}
            openClipDialog={openClipDialog}
          />

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
                    setPreviewingSelection(false)
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
                    // Plain scroll (trackpad/wheel) passes through as normal page
                    // scroll — only Ctrl/Cmd+scroll (and trackpad pinch, which
                    // browsers report as a ctrlKey wheel event) zooms the
                    // waveform, matching Figma/Maps convention instead of
                    // hijacking every scroll gesture over the canvas.
                    if (!(e.ctrlKey || e.metaKey)) return
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

          <ProAudioEditorTransport
            playing={playing}
            currentTime={currentTime}
            postDuration={postDuration}
            previewMode={previewMode}
            meterPeak={meterPeak}
            selection={selection}
            previewingSelection={previewingSelection}
            onTogglePlay={handleTogglePlay}
            onPreviewSelection={handlePreviewSelection}
            onPreviewModeChange={handlePreviewModeChange}
            onOpenExport={() => setExportDialogOpen(true)}
          />

          <ProAudioEditorChain
            plugins={editList.plugins}
            pluginsExpanded={pluginsExpanded}
            onPluginsExpandedChange={setPluginsExpanded}
            focusedInstanceId={focusedInstanceId}
            onFocusInstanceId={setFocusedInstanceId}
            previewBypassedPluginId={previewBypassedPluginId}
            onPreviewBypassedPluginIdChange={setPreviewBypassedPluginId}
            onPreviewModeAfter={() => setPreviewMode('after')}
            togglePlugin={togglePlugin}
            patchPlugin={patchPlugin}
            focusedPlugin={focusedPlugin}
            gainPlugin={gainPlugin}
            eqPlugin={eqPlugin}
            compPlugin={compPlugin}
            limiterPlugin={limiterPlugin}
            filterPlugin={filterPlugin}
            gainParams={gainParams}
            eqParams={eqParams}
            compParams={compParams}
            limiterParams={limiterParams}
            filterParams={filterParams}
            measuring={measuring}
            onMeasure={() => void handleMeasure()}
            onKnobDragStart={beginKnobDrag}
          />

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

      <CreateClipDialog
        open={clipDialogOpen}
        clipBusy={clipBusy}
        clipTitle={clipTitle}
        setClipTitle={setClipTitle}
        clipStartSec={clipStartSec}
        setClipStartSec={setClipStartSec}
        clipEndSec={clipEndSec}
        setClipEndSec={setClipEndSec}
        clipError={clipError}
        clipSuccess={clipSuccess}
        onClose={() => setClipDialogOpen(false)}
        onCreateClip={() => void handleCreateClip()}
      />

      <ExportDialog
        open={exportDialogOpen}
        exportFormat={exportFormat}
        setExportFormat={setExportFormat}
        browserRender={browserRender}
        isolated={isolated}
        exportProgress={exportProgress}
        exportPhase={exportPhase}
        exportError={exportError}
        previewError={previewError}
        previewLoading={previewLoading}
        ffmpeg={ffmpeg}
        ffmpegLoading={ffmpegLoading}
        onClose={() => setExportDialogOpen(false)}
        onPreviewSample={() => void handlePreviewSample()}
        onExport={(format) => void handleExport(format)}
      />
    </div>
  )
}
