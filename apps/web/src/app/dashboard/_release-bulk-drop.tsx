// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, ButtonIcon } from '@tahti/ui'
import { createRelease, finalizeReleaseTrack, prepareReleaseTrackUpload } from './release-actions'

const EXT_CONTENT_TYPE: Record<string, string> = {
  wav: 'audio/wav',
  flac: 'audio/flac',
  mp3: 'audio/mpeg',
  aac: 'audio/aac',
  aiff: 'audio/x-aiff',
  aif: 'audio/x-aiff',
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function extOf(filename: string): string {
  return (filename.split('.').pop() ?? '').toLowerCase()
}

function contentTypeFor(file: File): string | null {
  if (file.type && Object.values(EXT_CONTENT_TYPE).includes(file.type)) return file.type
  return EXT_CONTENT_TYPE[extOf(file.name)] ?? null
}

/** "01 - Track Name.wav" / "01_Track.wav" / "01. Track.wav" -> "Track Name". */
function titleFromFilename(filename: string): string {
  const noExt = filename.replace(/\.[^./]+$/, '')
  const noTrackNumber = noExt.replace(/^\s*\d{1,3}\s*[-_.)]\s*/, '')
  return noTrackNumber.replace(/[-_]+/g, ' ').trim() || noExt.trim()
}

/** Reads all files out of a dropped DataTransfer, recursing into folders (webkitGetAsEntry). */
async function filesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const items = Array.from(dataTransfer.items)
  const hasEntrySupport = items.length > 0 && typeof items[0]?.webkitGetAsEntry === 'function'
  if (!hasEntrySupport) return Array.from(dataTransfer.files)

  async function walk(entry: FileSystemEntry): Promise<File[]> {
    if (entry.isFile) {
      return new Promise((resolve) => {
        const fileEntry = entry as FileSystemFileEntry
        fileEntry.file(
          (file) => resolve([file]),
          () => resolve([]),
        )
      })
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      const entries: FileSystemEntry[] = await new Promise((resolve) => {
        const all: FileSystemEntry[] = []
        function readBatch() {
          reader.readEntries(
            (batch) => {
              if (batch.length === 0) return resolve(all)
              all.push(...batch)
              readBatch()
            },
            () => resolve(all),
          )
        }
        readBatch()
      })
      const nested = await Promise.all(entries.map(walk))
      return nested.flat()
    }
    return []
  }

  const entries = items
    .map((item) => item.webkitGetAsEntry())
    .filter((e): e is FileSystemEntry => e != null)
  const nested = await Promise.all(entries.map(walk))
  return nested.flat()
}

type TrackProgress = 'pending' | 'uploading' | 'done' | 'error'

interface ReviewTrack {
  key: string
  file: File
  title: string
}

export function ReleaseBulkDrop() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [releaseTitle, setReleaseTitle] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, TrackProgress>>({})
  const [review, setReview] = useState<ReviewTrack[] | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  function stageFiles(rawFiles: File[]) {
    const audioFiles = rawFiles.filter((f) => f.size > 0 && contentTypeFor(f) != null)
    if (audioFiles.length === 0) {
      setError('No supported audio files found (WAV, FLAC, MP3, AAC, AIFF).')
      return
    }
    if (!releaseTitle.trim()) {
      setError('Give the release a title first, then drop your tracks.')
      return
    }
    setError(null)
    const sorted = [...audioFiles].sort((a, b) => collator.compare(a.name, b.name))
    setReview(
      sorted.map((file, i) => ({
        key: `${file.name}:${file.size}:${i}`,
        file,
        title: titleFromFilename(file.name),
      })),
    )
  }

  function reorderReview(fromIdx: number, toIdx: number) {
    setReview((prev) => {
      if (!prev) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved!)
      return next
    })
  }

  function updateReviewTitle(key: string, title: string) {
    setReview((prev) => (prev ? prev.map((t) => (t.key === key ? { ...t, title } : t)) : prev))
  }

  function cancelReview() {
    setReview(null)
    setError(null)
  }

  async function startUpload() {
    if (!review || review.length === 0) return
    if (!releaseTitle.trim()) {
      setError('Give the release a title first.')
      return
    }

    setError(null)
    setBusy(true)
    setProgress(Object.fromEntries(review.map((t) => [t.key, 'pending'])))

    const created = await createRelease({
      title: releaseTitle.trim(),
      type: review.length > 1 ? 'ALBUM' : 'SINGLE',
      releaseDate: new Date().toISOString().slice(0, 10),
      tracks: review.map((t) => ({ title: t.title.trim() || titleFromFilename(t.file.name) })),
    })
    if (created.error || !created.releaseId || !created.tracks) {
      setError(created.error ?? 'Failed to create release')
      setBusy(false)
      return
    }
    const releaseId = created.releaseId

    await Promise.all(
      created.tracks.map(async (track, i) => {
        const entry = review[i]
        if (!entry) return
        setProgress((p) => ({ ...p, [entry.key]: 'uploading' }))
        const contentType = contentTypeFor(entry.file) ?? 'audio/wav'
        const prep = await prepareReleaseTrackUpload(
          releaseId,
          track.id,
          entry.file.name,
          contentType,
        )
        if (prep.error || !prep.uploadUrl) {
          setProgress((p) => ({ ...p, [entry.key]: 'error' }))
          return
        }
        const putRes = await fetch(prep.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: entry.file,
        })
        if (!putRes.ok) {
          setProgress((p) => ({ ...p, [entry.key]: 'error' }))
          return
        }
        const fin = await finalizeReleaseTrack(releaseId, track.id)
        setProgress((p) => ({ ...p, [entry.key]: fin.error ? 'error' : 'done' }))
      }),
    )

    setBusy(false)
    router.push(`/dashboard/releases/${releaseId}`)
  }

  return (
    <div className="studio-subsection studio-mt-md">
      <input
        placeholder="Release title (e.g. Night Signals)"
        value={releaseTitle}
        onChange={(e) => setReleaseTitle(e.target.value)}
        className="studio-input studio-w-full"
        aria-label="New release title for bulk upload"
        disabled={busy || review != null}
      />

      {!review && (
        <div
          className={`upload-entry__tile upload-entry__tile--drop studio-mt-sm${dragOver ? ' upload-entry__tile--dragover' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            void filesFromDataTransfer(e.dataTransfer).then(stageFiles)
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Drop a folder or multiple audio files to create an album"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".flac,.wav,.aiff,.aif,.mp3,.m4a,.aac,audio/*"
            multiple
            className="upload-entry__file-input"
            onChange={(e) => {
              if (e.target.files?.length) stageFiles(Array.from(e.target.files))
              e.target.value = ''
            }}
          />
          <div className="upload-entry__drop-icon" aria-hidden>
            ↑
          </div>
          <p className="upload-entry__drop-label">
            Drop a folder of tracks, or select multiple files
          </p>
          <p className="upload-entry__drop-formats">
            Track order and titles are taken from filenames — WAV · FLAC · MP3 · AAC · AIFF
          </p>
        </div>
      )}

      {review && !busy && (
        <div className="studio-mt-sm">
          <p className="studio-help">
            Review the track order and titles, then create the album. Drag rows to reorder.
          </p>
          <ul className="studio-list studio-mt-sm">
            {review.map((track, index) => (
              <li
                key={track.key}
                className="studio-programme-row schedule-rotation-row--draggable"
                draggable
                onDragStart={() => setDragIdx(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragIdx !== null && dragIdx !== index) reorderReview(dragIdx, index)
                  setDragIdx(null)
                }}
              >
                <span className="schedule-rotation-row__handle" aria-hidden>
                  ⠿
                </span>
                <span className="studio-programme-label">
                  <input
                    value={track.title}
                    onChange={(e) => updateReviewTitle(track.key, e.target.value)}
                    className="studio-input studio-w-full"
                    aria-label={`Track title for ${track.file.name}`}
                  />
                </span>
              </li>
            ))}
          </ul>
          <div className="studio-actions studio-mt-sm">
            <Button onClick={startUpload} variant="primary">
              <ButtonIcon name="check" />
              Create album
            </Button>
            <Button onClick={cancelReview} variant="ghost">
              Start over
            </Button>
          </div>
        </div>
      )}

      {busy && review && (
        <ul className="studio-list studio-mt-sm">
          {review.map((track) => {
            const state = progress[track.key] ?? 'pending'
            return (
              <li key={track.key} className="studio-item-row--list">
                <span className="studio-flex-1 studio-text-sm">{track.title}</span>
                <span
                  className={
                    state === 'error'
                      ? 'studio-text-error'
                      : state === 'done'
                        ? 'studio-text-success'
                        : 'studio-text-muted-sm'
                  }
                >
                  {state === 'pending' && 'Waiting…'}
                  {state === 'uploading' && 'Uploading…'}
                  {state === 'done' && <ButtonIcon name="check" />}
                  {state === 'error' && 'Failed'}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
    </div>
  )
}
