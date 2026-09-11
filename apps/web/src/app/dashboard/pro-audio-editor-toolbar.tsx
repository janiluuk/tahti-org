// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { Button } from '@tahti/ui'
import type { HistoryState } from '@tahti/audio-edit'
import { History } from '@tahti/audio-edit'
import { cx } from './pro-audio-editor-controls'

type ToolId = 'select' | 'cut' | 'fade' | 'marker'

export function ProAudioEditorToolbar({
  activeTool,
  setActiveTool,
  span,
  setSpan,
  zoomSliderValue,
  msPerPx,
  setViewStart,
  setViewEnd,
  setSelection,
  selection,
  sourceDuration,
  undo,
  redo,
  historyState,
  snapEnabled,
  setSnapEnabled,
  openClipDialog,
}: {
  activeTool: ToolId
  setActiveTool: (tool: ToolId) => void
  span: number
  setSpan: (rawSpan: number) => void
  zoomSliderValue: number
  msPerPx: number
  setViewStart: (start: number) => void
  setViewEnd: (end: number) => void
  setSelection: (selection: { start: number; end: number } | null) => void
  selection: { start: number; end: number } | null
  sourceDuration: number
  undo: () => void
  redo: () => void
  historyState: HistoryState
  snapEnabled: boolean
  setSnapEnabled: React.Dispatch<React.SetStateAction<boolean>>
  openClipDialog: () => void
}) {
  return (
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
          onClick={() => setSpan(span * 1.25)}
          aria-label="Zoom out"
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
          onClick={() => setSpan(span * 0.8)}
          aria-label="Zoom in"
        >
          +
        </button>
        <span className="pro-editor-zoom-ratio">1 px = {msPerPx.toFixed(0)} ms</span>
        <Button
          onClick={() => {
            setViewStart(0)
            setViewEnd(1)
            setSelection(null)
          }}
          variant="ghost"
          size="sm"
        >
          Reset zoom
        </Button>
        <Button
          disabled={!selection}
          onClick={() => {
            if (!selection) return
            setViewStart(Math.max(0, selection.start / sourceDuration))
            setViewEnd(Math.min(1, selection.end / sourceDuration))
          }}
          variant="ghost"
          size="sm"
        >
          Sel
        </Button>
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

      <Button onClick={openClipDialog} variant="ghost" size="sm" title="Create a ≤60s clip">
        Create clip
      </Button>

      <div className="pro-editor-shortcut-hints">
        <span>space play/pause</span>
        <span>x cut</span>
        <span>⌘z undo</span>
      </div>
    </div>
  )
}
