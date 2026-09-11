// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback } from 'react'
import type { EditListV2, OutputFormat } from '@tahti/audio-edit'
import type { GainParams } from '@tahti/audio-edit'
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { SOUND_CLIP_MAX_DURATION_SEC, type TracklistEntry } from '@tahti/shared'
import {
  completeSoundVersionUpload,
  createSoundClip,
  prepareSoundVersionUpload,
  renderSoundEditList,
  fetchSoundVersionDownloadUrl,
  updateSoundMetadata,
} from '@/app/dashboard/sound-actions'
import { measureLoudnorm, renderEditToFile } from '@/lib/audio-editor/ffmpeg-client'
import { v2ToV1 } from '@/lib/audio-editor/edit-list-convert'
import { waitForRenderViaProgress } from '@/lib/audio-editor/render-progress'

export function useExportAndClip(deps: {
  soundId: string
  title: string
  editList: EditListV2
  browserRender: boolean
  ffmpeg: FFmpeg | null
  inputPathRef: React.RefObject<string | null>
  tracklist: TracklistEntry[] | null
  clipStartSec: number
  clipEndSec: number
  clipTitle: string
  snappedSelection: () => { start: number; end: number } | null
  pushEdit: (next: EditListV2, label?: string) => void
  setClipStartSec: (sec: number) => void
  setClipEndSec: (sec: number) => void
  setClipTitle: (title: string) => void
  setClipError: (error: string | null) => void
  setClipSuccess: (success: { clipId: string; title: string } | null) => void
  setClipDialogOpen: (open: boolean) => void
  setClipBusy: (busy: boolean) => void
  setSelection: (selection: { start: number; end: number } | null) => void
  setTracklistSaving: (saving: boolean) => void
  setTracklistError: (error: string | null) => void
  setMeasuring: (measuring: boolean) => void
  setPreviewError: (error: string | null) => void
  setPreviewLoading: (loading: boolean) => void
  setExportProgress: (progress: number | null) => void
  setExportPhase: (phase: string | null) => void
  setExportError: (error: string | null) => void
  setExportSuccess: (success: { versionNumber: number; versionLabel: string } | null) => void
  setExportDialogOpen: (open: boolean) => void
}) {
  const {
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
  } = deps

  const openClipDialog = useCallback(() => {
    const sel = snappedSelection()
    const sourceDur = editList.sourceDuration || 0
    let start = sel?.start ?? 0
    let end = sel?.end ?? Math.min(SOUND_CLIP_MAX_DURATION_SEC, sourceDur || 30)
    if (end - start > SOUND_CLIP_MAX_DURATION_SEC) {
      end = start + SOUND_CLIP_MAX_DURATION_SEC
    }
    if (sourceDur > 0 && end > sourceDur) end = sourceDur
    if (end <= start) {
      start = 0
      end = Math.min(SOUND_CLIP_MAX_DURATION_SEC, sourceDur || 30)
    }
    setClipStartSec(Math.round(start * 10) / 10)
    setClipEndSec(Math.round(end * 10) / 10)
    setClipTitle(`${title.slice(0, 100)}${title.length > 100 ? '…' : ''} (clip)`)
    setClipError(null)
    setClipSuccess(null)
    setClipDialogOpen(true)
  }, [
    editList.sourceDuration,
    snappedSelection,
    title,
    setClipStartSec,
    setClipEndSec,
    setClipTitle,
    setClipError,
    setClipSuccess,
    setClipDialogOpen,
  ])

  const handleCreateClip = useCallback(async () => {
    setClipError(null)
    setClipSuccess(null)
    const start = clipStartSec
    const end = clipEndSec
    if (!(end > start)) {
      setClipError('End must be after start')
      return
    }
    if (end - start > SOUND_CLIP_MAX_DURATION_SEC) {
      setClipError(`Clip must be ${SOUND_CLIP_MAX_DURATION_SEC} seconds or less`)
      return
    }
    setClipBusy(true)
    try {
      const result = await createSoundClip(soundId, {
        startSec: start,
        endSec: end,
        title: clipTitle.trim() || undefined,
      })
      if (result.error || !result.clipId) {
        setClipError(result.error ?? 'Failed to create clip')
        return
      }
      setClipSuccess({ clipId: result.clipId, title: result.title ?? clipTitle })
      setSelection({ start, end })
    } finally {
      setClipBusy(false)
    }
  }, [
    clipStartSec,
    clipEndSec,
    clipTitle,
    soundId,
    setClipError,
    setClipSuccess,
    setClipBusy,
    setSelection,
  ])

  const saveTracklist = useCallback(async () => {
    setTracklistSaving(true)
    setTracklistError(null)
    const res = await updateSoundMetadata(soundId, { tracklist })
    setTracklistSaving(false)
    if (res.error) setTracklistError(res.error)
  }, [soundId, tracklist, setTracklistSaving, setTracklistError])

  const handleMeasure = useCallback(async () => {
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
  }, [ffmpeg, inputPathRef, editList, pushEdit, setMeasuring])

  const handlePreviewSample = useCallback(async () => {
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

      const res = await renderSoundEditList(soundId, {
        editList: v1,
        versionLabel: `Preview ${new Date().toISOString().slice(0, 16)}`,
        activate: false,
        format: 'mp3',
        maxDurationSec: 30,
        sampleOnly: true,
      })
      if (res.error || !res.versionId) throw new Error(res.error ?? 'Server preview failed')

      await waitForRenderViaProgress(soundId, res.versionId, (event) => {
        if (typeof event.pct === 'number') setExportProgress(event.pct)
        if (event.phase) setExportPhase(event.phase)
      })
      setExportProgress(null)
      setExportPhase(null)

      const dl = await fetchSoundVersionDownloadUrl(soundId, res.versionId)
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
  }, [
    editList,
    browserRender,
    ffmpeg,
    inputPathRef,
    soundId,
    title,
    setPreviewError,
    setPreviewLoading,
    setExportProgress,
    setExportPhase,
  ])

  const handleExport = useCallback(
    async (format: OutputFormat) => {
      setExportError(null)
      setExportSuccess(null)
      setExportProgress(0)
      const label = `Pro edit ${new Date().toISOString().slice(0, 10)}`
      const v1 = v2ToV1(editList)

      try {
        if (!browserRender) {
          const res = await renderSoundEditList(soundId, {
            editList: v1,
            versionLabel: label,
            activate: true,
            format: format === 'wav' ? 'flac' : format,
          })
          if (res.error || !res.versionId) throw new Error(res.error ?? 'Server render failed')

          const done = await waitForRenderViaProgress(soundId, res.versionId, (event) => {
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
            const gainPlugin = editList.plugins.find((p) => p.pluginId === 'gain')!
            const updated: EditListV2 = {
              ...editList,
              plugins: editList.plugins.map((p) =>
                p.instanceId === gainPlugin.instanceId
                  ? { ...p, params: { ...(gainPlugin.params as GainParams), measured } }
                  : p,
              ),
            }
            pushEdit(updated, 'Measure for export')
            list = v2ToV1(updated)
          }
        }

        const out = await renderEditToFile(ffmpeg, list, inputPathRef.current, format)
        const contentType =
          format === 'mp3' ? 'audio/mpeg' : format === 'wav' ? 'audio/wav' : 'audio/flac'
        const filename = `edit.${format}`
        const bytes = new Uint8Array(out)
        const blob = new Blob([bytes], { type: contentType })
        const prep = await prepareSoundVersionUpload(soundId, { filename, contentType })
        if (prep.error || !prep.uploadUrl || !prep.uploadId)
          throw new Error(prep.error ?? 'Prepare failed')

        await fetch(prep.uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': contentType },
        })
        const done = await completeSoundVersionUpload(soundId, {
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
    },
    [
      editList,
      browserRender,
      ffmpeg,
      inputPathRef,
      soundId,
      pushEdit,
      setExportError,
      setExportSuccess,
      setExportProgress,
      setExportPhase,
      setExportDialogOpen,
    ],
  )

  return {
    openClipDialog,
    handleCreateClip,
    saveTracklist,
    handleMeasure,
    handlePreviewSample,
    handleExport,
  }
}
