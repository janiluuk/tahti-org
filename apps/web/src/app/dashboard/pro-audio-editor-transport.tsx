// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { ButtonIcon, Button } from '@tahti/ui'
import { formatDuration } from '@/lib/audio-editor/format'
import { cx } from './pro-audio-editor-controls'

export function ProAudioEditorTransport({
  playing,
  currentTime,
  postDuration,
  previewMode,
  meterPeak,
  selection,
  previewingSelection,
  onTogglePlay,
  onPreviewSelection,
  onPreviewModeChange,
  onOpenExport,
}: {
  playing: boolean
  currentTime: number
  postDuration: number
  previewMode: 'before' | 'after'
  meterPeak: number
  selection: { start: number; end: number } | null
  previewingSelection: boolean
  onTogglePlay: () => void
  onPreviewSelection: () => void
  onPreviewModeChange: (mode: 'before' | 'after') => void
  onOpenExport: () => void
}) {
  return (
    <div className="pro-editor-transport">
      <button
        type="button"
        className="pro-editor-play-btn"
        aria-label={playing ? 'Pause' : 'Play'}
        onClick={onTogglePlay}
      >
        {playing ? '⏸' : '▶'}
      </button>
      {selection && selection.end - selection.start > 0 && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onPreviewSelection}
          disabled={previewingSelection && playing}
        >
          <ButtonIcon name="play" />
          {previewingSelection && playing ? 'Previewing…' : 'Preview selection'}
        </Button>
      )}
      <span className="pro-editor-time">{formatDuration(currentTime)}</span>
      <span className="pro-editor-time-total">/ {formatDuration(postDuration)}</span>
      <span className="pro-editor-preview-note">
        {previewMode === 'before' ? 'original chain bypassed' : 'effects preview'} · render for
        final result
      </span>
      <div className="pro-editor-preview-compare" role="group" aria-label="Plugin chain preview">
        <button
          type="button"
          className={cx('pro-editor-preview-compare__btn', previewMode === 'before' && 'is-active')}
          onClick={() => onPreviewModeChange('before')}
        >
          Before
        </button>
        <button
          type="button"
          className={cx('pro-editor-preview-compare__btn', previewMode === 'after' && 'is-active')}
          onClick={() => onPreviewModeChange('after')}
        >
          After
        </button>
        <Button onClick={onOpenExport} variant="primary" size="sm">
          <ButtonIcon name="download" />
          Export
        </Button>
      </div>
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
  )
}
