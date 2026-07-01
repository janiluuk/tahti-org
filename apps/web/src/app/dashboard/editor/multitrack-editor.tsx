// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ButtonIcon } from '@tahti/ui'
import type { ClipTrack } from '@waveform-playlist/browser'
import {
  PauseButton,
  PlayButton,
  PlaylistVisualization,
  StopButton,
  WaveformPlaylistProvider,
  useDynamicTracks,
  useExportWav,
  useOutputMeter,
  usePlaybackAnimation,
  usePlaylistData,
} from '@waveform-playlist/browser'
import { completeArchiveVersionUpload, prepareArchiveVersionUpload } from '../archive-actions'
import { saveEditorProject } from './editor-actions'

type EditorSource = {
  archiveItemId: string
  title: string
  url: string
  durationSec: number | null
}

function ExportPanel({
  archiveItemId,
  versionLabel,
}: {
  archiveItemId: string | null
  versionLabel: string
}) {
  const { tracks, trackStates } = usePlaylistData()
  const { exportWav, isExporting, progress, error } = useExportWav()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function exportToArchive() {
    if (!archiveItemId) {
      setUploadError('Link this session to an archive item before exporting')
      return
    }
    const label = versionLabel.trim()
    if (!label) {
      setUploadError('Enter a version label')
      return
    }

    setUploadError(null)
    setDone(false)
    try {
      const result = await exportWav(tracks, trackStates, {
        mode: 'master',
        autoDownload: false,
        applyEffects: true,
      })
      const file = new File([result.blob], 'mixdown.wav', { type: 'audio/wav' })
      const prep = await prepareArchiveVersionUpload(archiveItemId, {
        filename: file.name,
        contentType: 'audio/wav',
      })
      if (prep.error || !prep.uploadUrl || !prep.uploadId) {
        setUploadError(prep.error ?? 'Prepare upload failed')
        return
      }
      await fetch(prep.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/wav' },
        body: file,
      })
      const complete = await completeArchiveVersionUpload(archiveItemId, {
        uploadId: prep.uploadId,
        versionLabel: label,
        fileSizeBytes: file.size,
      })
      if (complete.error) {
        setUploadError(complete.error)
        return
      }
      setDone(true)
    } catch {
      setUploadError('Export failed')
    }
  }

  return (
    <div className="studio-row studio-row--wrap studio-mt-md">
      <button
        type="button"
        className="ui-btn ui-btn--primary"
        disabled={isExporting || !archiveItemId}
        onClick={() => void exportToArchive()}
      >
        <ButtonIcon name="save" />
        {isExporting ? `Exporting ${Math.round(progress * 100)}%…` : 'Save mix to archive'}
      </button>
      {done && <span className="studio-text-muted-sm">Queued for transcode.</span>}
      {(error || uploadError) && (
        <p className="studio-text-error studio-m-0">{error ?? uploadError}</p>
      )}
    </div>
  )
}

function OutputMeters() {
  const { isPlaying } = usePlaybackAnimation()
  const { rmsLevels } = useOutputMeter({ isPlaying, updateRate: 30 })
  const rms = rmsLevels[0] ?? 0
  const approxLufs = rms > 0 ? 20 * Math.log10(rms) - 0.691 : -60
  const pct = Math.min(100, Math.round(rms * 100))

  return (
    <div className="studio-editor-meters">
      <div className="studio-editor-meter">
        <span className="studio-text-muted-sm">RMS</span>
        <div className="studio-editor-meter-bar">
          <div className="studio-editor-meter-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="studio-text-muted-sm">approx. {approxLufs.toFixed(1)} LUFS (preview)</span>
    </div>
  )
}

function EditorWorkspace({
  projectId,
  tracks,
  deferEngineRebuild,
  onTracksChange,
  archiveItemId,
  versionLabel,
}: {
  projectId: string
  tracks: ClipTrack[]
  deferEngineRebuild: boolean
  onTracksChange: (tracks: ClipTrack[]) => void
  archiveItemId: string | null
  versionLabel: string
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTracksChange = useCallback(
    (next: ClipTrack[]) => {
      onTracksChange(next)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void saveEditorProject(projectId, {
          timeline: { tracks: next as unknown as Record<string, unknown>[] },
        })
      }, 2000)
    },
    [onTracksChange, projectId],
  )

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      deferEngineRebuild={deferEngineRebuild}
      onTracksChange={handleTracksChange}
      timescale
      waveHeight={80}
    >
      <div className="studio-editor-transport">
        <PlayButton />
        <PauseButton />
        <StopButton />
        <OutputMeters />
      </div>
      <PlaylistVisualization
        interactiveClips
        showFades
        showClipHeaders
        className="studio-playlist-viz"
      />
      <ExportPanel archiveItemId={archiveItemId} versionLabel={versionLabel} />
    </WaveformPlaylistProvider>
  )
}

export function MultitrackEditor({
  projectId,
  title: initialTitle,
  archiveItemId,
  timeline,
  sources,
}: {
  projectId: string
  title: string
  archiveItemId: string | null
  timeline: Record<string, unknown>
  sources: EditorSource[]
}) {
  const router = useRouter()
  const { tracks, addTracks, isLoading, errors } = useDynamicTracks()
  const seeded = useRef(false)
  const [title, setTitle] = useState(initialTitle)
  const [versionLabel, setVersionLabel] = useState(`${initialTitle} mix`)
  const [isPending, startTransition] = useTransition()
  const [displayTracks, setDisplayTracks] = useState<ClipTrack[]>([])

  useEffect(() => {
    if (seeded.current) return
    const saved = timeline.tracks
    if (Array.isArray(saved) && saved.length > 0) {
      seeded.current = true
      setDisplayTracks(saved as ClipTrack[])
      return
    }
    if (sources.length === 0) return
    seeded.current = true
    addTracks(sources.map((s) => ({ src: s.url, name: s.title })))
  }, [addTracks, sources, timeline.tracks])

  useEffect(() => {
    if (tracks.length > 0) setDisplayTracks(tracks)
  }, [tracks])

  function saveTitle() {
    startTransition(async () => {
      await saveEditorProject(projectId, { title: title.trim() })
      router.refresh()
    })
  }

  const readyTracks = displayTracks.length > 0 ? displayTracks : tracks

  return (
    <div className="studio-multitrack-editor">
      <div className="studio-row studio-row--between studio-mb-md">
        <label className="studio-field studio-field--grow studio-m-0">
          <span className="studio-label">Session title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            disabled={isPending}
            className="studio-input"
          />
        </label>
        <label className="studio-field studio-field--grow studio-m-0">
          <span className="studio-label">Archive version label</span>
          <input
            type="text"
            value={versionLabel}
            onChange={(e) => setVersionLabel(e.target.value)}
            className="studio-input"
          />
        </label>
      </div>

      {isLoading && <p className="studio-text-muted-sm">Loading audio…</p>}
      {errors.map((err) => (
        <p key={err.name} className="studio-text-error">
          Failed to load {err.name}
        </p>
      ))}

      <div className="studio-row studio-row--wrap studio-mb-md">
        <label className="studio-file-label">
          Add track
          <input
            type="file"
            accept="audio/*"
            className="studio-hidden-input"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) addTracks([file])
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {readyTracks.length > 0 && (
        <EditorWorkspace
          projectId={projectId}
          tracks={readyTracks}
          deferEngineRebuild={isLoading}
          onTracksChange={setDisplayTracks}
          archiveItemId={archiveItemId}
          versionLabel={versionLabel}
        />
      )}
    </div>
  )
}
