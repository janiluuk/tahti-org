// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { ButtonIcon, Button } from '@tahti/ui'
import type { OutputFormat } from '@tahti/audio-edit'
import { SOUND_CLIP_MAX_DURATION_SEC } from '@tahti/shared'
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { formatDurationDecimal } from '@/lib/audio-editor/format'
import { cx } from './pro-audio-editor-controls'

export function CreateClipDialog({
  open,
  clipBusy,
  clipTitle,
  setClipTitle,
  clipStartSec,
  setClipStartSec,
  clipEndSec,
  setClipEndSec,
  clipError,
  clipSuccess,
  onClose,
  onCreateClip,
}: {
  open: boolean
  clipBusy: boolean
  clipTitle: string
  setClipTitle: (title: string) => void
  clipStartSec: number
  setClipStartSec: (sec: number) => void
  clipEndSec: number
  setClipEndSec: (sec: number) => void
  clipError: string | null
  clipSuccess: { clipId: string; title: string } | null
  onClose: () => void
  onCreateClip: () => void
}) {
  if (!open) return null

  return (
    <div className="pro-editor-dialog-backdrop" onClick={() => !clipBusy && onClose()}>
      <div
        className="pro-editor-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="create-clip-title"
      >
        <h2 id="create-clip-title" className="pro-editor-dialog__title">
          Create clip
        </h2>
        <p className="pro-editor-panel__hint" style={{ margin: 0 }}>
          Cut up to {SOUND_CLIP_MAX_DURATION_SEC} seconds from this track for radio station IDs /
          announcements. Drag a selection on the waveform first, or set begin and end below.
        </p>
        <label className="pro-editor-field">
          <span className="pro-editor-field__label">Title</span>
          <input
            type="text"
            className="pro-editor-field__input"
            value={clipTitle}
            maxLength={120}
            onChange={(e) => setClipTitle(e.target.value)}
            disabled={clipBusy || !!clipSuccess}
          />
        </label>
        <div className="pro-editor-field-row">
          <label className="pro-editor-field">
            <span className="pro-editor-field__label">Beginning (sec)</span>
            <input
              type="number"
              className="pro-editor-field__input"
              min={0}
              step={0.1}
              value={clipStartSec}
              onChange={(e) => setClipStartSec(Number(e.target.value))}
              disabled={clipBusy || !!clipSuccess}
            />
          </label>
          <label className="pro-editor-field">
            <span className="pro-editor-field__label">Ending (sec)</span>
            <input
              type="number"
              className="pro-editor-field__input"
              min={0}
              step={0.1}
              value={clipEndSec}
              onChange={(e) => setClipEndSec(Number(e.target.value))}
              disabled={clipBusy || !!clipSuccess}
            />
          </label>
        </div>
        <p className="pro-editor-panel__hint" style={{ margin: 0 }}>
          Length: <strong>{formatDurationDecimal(Math.max(0, clipEndSec - clipStartSec))}</strong>
          {clipEndSec - clipStartSec > SOUND_CLIP_MAX_DURATION_SEC
            ? ` — max ${SOUND_CLIP_MAX_DURATION_SEC}s`
            : ''}
        </p>
        {clipError && <p className="studio-text-error">{clipError}</p>}
        {clipSuccess && (
          <p className="pro-editor-export-success">
            Clip &ldquo;{clipSuccess.title}&rdquo; is rendering —{' '}
            <Link href={`/dashboard/settings/announcements/editor/${clipSuccess.clipId}`}>
              open clip editor
            </Link>
            {' · '}
            <Link href="/dashboard/settings/distribution">announcements</Link>
          </p>
        )}
        <div className="pro-editor-dialog__actions">
          <Button onClick={onClose} variant="ghost" size="sm" disabled={clipBusy}>
            {clipSuccess ? 'Close' : 'Cancel'}
          </Button>
          {!clipSuccess && (
            <Button
              onClick={onCreateClip}
              variant="primary"
              disabled={
                clipBusy ||
                !(clipEndSec > clipStartSec) ||
                clipEndSec - clipStartSec > SOUND_CLIP_MAX_DURATION_SEC
              }
            >
              {clipBusy ? 'Creating…' : 'Create clip'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function ExportDialog({
  open,
  exportFormat,
  setExportFormat,
  browserRender,
  isolated,
  exportProgress,
  exportPhase,
  exportError,
  previewError,
  previewLoading,
  ffmpeg,
  ffmpegLoading,
  onClose,
  onPreviewSample,
  onExport,
}: {
  open: boolean
  exportFormat: OutputFormat
  setExportFormat: (format: OutputFormat) => void
  browserRender: boolean
  isolated: boolean
  exportProgress: number | null
  exportPhase: string | null
  exportError: string | null
  previewError: string | null
  previewLoading: boolean
  ffmpeg: FFmpeg | null
  ffmpegLoading: boolean
  onClose: () => void
  onPreviewSample: () => void
  onExport: (format: OutputFormat) => void
}) {
  if (!open) return null

  return (
    <div className="pro-editor-dialog-backdrop" onClick={onClose}>
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
          <Button
            disabled={
              previewLoading ||
              exportProgress !== null ||
              (browserRender && (!ffmpeg || ffmpegLoading))
            }
            onClick={onPreviewSample}
            variant="ghost"
            size="sm"
          >
            {previewLoading ? 'Rendering preview…' : 'Preview 30s MP3'}
          </Button>
          <Button onClick={onClose} variant="ghost" size="sm">
            Cancel
          </Button>
          <Button
            disabled={exportProgress !== null || (browserRender && (!ffmpeg || ffmpegLoading))}
            onClick={() => onExport(exportFormat)}
            variant="primary"
          >
            <ButtonIcon name="download" />
            {browserRender
              ? `Export ${exportFormat.toUpperCase()}`
              : `Export ${exportFormat.toUpperCase()} (server)`}
          </Button>
        </div>
      </div>
    </div>
  )
}
