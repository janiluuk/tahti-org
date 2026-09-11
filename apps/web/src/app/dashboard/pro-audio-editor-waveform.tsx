// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { RefObject } from 'react'
import type { PeaksPyramid } from '@tahti/audio-edit'
import { MINIMAP_HEIGHT, WAVE_HEIGHT } from '@/lib/audio-editor/use-waveform-canvas'
import { formatDuration, formatDurationDecimal } from '@/lib/audio-editor/format'

type ToolId = 'select' | 'cut' | 'fade' | 'marker'

type Selection = { start: number; end: number } | null

export function ProAudioEditorWaveform({
  peaks,
  peaksLoading,
  sourceDuration,
  wavePanelRef,
  waveRef,
  overlayRef,
  minimapRef,
  audioRef,
  canvasWidth,
  viewStart,
  span,
  setViewStart,
  setViewEnd,
  selection,
  setSelection,
  setPreviewingSelection,
  ruler,
  activeTool,
  snapSec,
  secFromCanvasEvent,
  seekToSec,
  removeSelection,
  applyFadeAtSelection,
  snappedSelection,
}: {
  peaks: PeaksPyramid | null
  peaksLoading: boolean
  sourceDuration: number
  wavePanelRef: RefObject<HTMLDivElement>
  waveRef: RefObject<HTMLCanvasElement>
  overlayRef: RefObject<HTMLCanvasElement>
  minimapRef: RefObject<HTMLCanvasElement>
  audioRef: RefObject<HTMLAudioElement>
  canvasWidth: number
  viewStart: number
  span: number
  setViewStart: (v: number) => void
  setViewEnd: (v: number) => void
  selection: Selection
  setSelection: (s: Selection) => void
  setPreviewingSelection: (v: boolean) => void
  ruler: number[]
  activeTool: ToolId
  snapSec: (sec: number) => number
  secFromCanvasEvent: (clientX: number, rect: DOMRect) => number
  seekToSec: (sec: number) => void
  removeSelection: () => void
  applyFadeAtSelection: () => void
  snappedSelection: () => Selection
}) {
  return (
    <>
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
        <audio ref={audioRef} className="pro-editor-audio" crossOrigin="anonymous" preload="auto" />
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
          <span>{formatDuration(sourceDuration)}</span>
        </div>
      </div>
    </>
  )
}
