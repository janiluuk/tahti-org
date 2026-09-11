// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditCutV2, PeaksPyramid } from '@tahti/audio-edit'
import { snapToNearestZeroCrossing } from '@tahti/audio-edit'
import {
  drawMinimapLayer,
  drawOverlayLayer,
  drawWaveformLayer,
} from '@/lib/audio-editor/waveform-draw'

export const CANVAS_MIN_WIDTH = 320
export const CANVAS_DEFAULT_WIDTH = 1280
export const WAVE_HEIGHT = 340
export const MINIMAP_HEIGHT = 38

export function useWaveformCanvas({
  peaks,
  cuts,
  sourceDuration,
  snapEnabled,
}: {
  peaks: PeaksPyramid | null
  cuts: EditCutV2[]
  sourceDuration: number
  snapEnabled: boolean
}) {
  const [viewStart, setViewStart] = useState(0)
  const [viewEnd, setViewEnd] = useState(1)
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)
  const [previewingSelection, setPreviewingSelection] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [canvasWidth, setCanvasWidth] = useState(CANVAS_DEFAULT_WIDTH)

  const wavePanelRef = useRef<HTMLDivElement>(null)
  const waveRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const minimapRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const snapSec = useCallback(
    (sec: number) => {
      if (!snapEnabled || !peaks?.zeroCrossingsSec?.length) return sec
      return snapToNearestZeroCrossing(peaks.zeroCrossingsSec, sec)
    },
    [snapEnabled, peaks?.zeroCrossingsSec],
  )

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
    if (wctx) drawWaveformLayer(wctx, pyramid, view, cuts)
    if (octx) drawOverlayLayer(octx, pyramid, view)
    if (minimap) {
      const mctx = minimap.getContext('2d')
      if (mctx) drawMinimapLayer(mctx, pyramid)
    }
  }, [peaks, viewStart, viewEnd, selection, cuts])

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
      if (previewingSelection && selection && audio.currentTime >= selection.end) {
        audio.pause()
        audio.currentTime = selection.start
        setPreviewingSelection(false)
      }
    }
    audio.addEventListener('timeupdate', onTime)
    return () => audio.removeEventListener('timeupdate', onTime)
  }, [redraw, previewingSelection, selection])

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
  const msPerPx = (span * sourceDuration * 1000) / canvasWidth

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
      const clamped = Math.max(0, Math.min(sourceDuration, sec))
      if (audioRef.current) audioRef.current.currentTime = clamped
      setPreviewingSelection(false)
      const center = clamped / sourceDuration
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
    [sourceDuration, span],
  )

  function handlePreviewSelection() {
    const audio = audioRef.current
    if (!audio || !selection || selection.end - selection.start <= 0) return
    audio.currentTime = selection.start
    setPreviewingSelection(true)
    void audio.play()
  }

  const ruler = useMemo(() => {
    const ticks: number[] = []
    for (let i = 0; i <= 6; i++) {
      ticks.push((viewStart + (i / 6) * span) * sourceDuration)
    }
    return ticks
  }, [viewStart, span, sourceDuration])

  return {
    wavePanelRef,
    waveRef,
    overlayRef,
    minimapRef,
    audioRef,
    viewStart,
    viewEnd,
    setViewStart,
    setViewEnd,
    selection,
    setSelection,
    previewingSelection,
    setPreviewingSelection,
    currentTime,
    canvasWidth,
    snapSec,
    redraw,
    setSpan,
    span,
    zoomSliderValue,
    msPerPx,
    snappedSelection,
    secFromCanvasEvent,
    seekToSec,
    handlePreviewSelection,
    ruler,
  }
}
