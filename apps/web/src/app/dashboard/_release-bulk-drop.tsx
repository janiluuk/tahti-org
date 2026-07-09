// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ButtonIcon } from '@tahti/ui'
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

export function ReleaseBulkDrop() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [releaseTitle, setReleaseTitle] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, TrackProgress>>({})

  async function handleFiles(rawFiles: File[]) {
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
    setBusy(true)

    const sorted = [...audioFiles].sort((a, b) => collator.compare(a.name, b.name))
    setProgress(Object.fromEntries(sorted.map((f) => [f.name, 'pending'])))

    const created = await createRelease({
      title: releaseTitle.trim(),
      type: sorted.length > 1 ? 'ALBUM' : 'SINGLE',
      releaseDate: new Date().toISOString().slice(0, 10),
      tracks: sorted.map((f) => ({ title: titleFromFilename(f.name) })),
    })
    if (created.error || !created.releaseId || !created.tracks) {
      setError(created.error ?? 'Failed to create release')
      setBusy(false)
      return
    }
    const releaseId = created.releaseId

    await Promise.all(
      created.tracks.map(async (track, i) => {
        const file = sorted[i]
        if (!file) return
        setProgress((p) => ({ ...p, [file.name]: 'uploading' }))
        const contentType = contentTypeFor(file) ?? 'audio/wav'
        const prep = await prepareReleaseTrackUpload(releaseId, track.id, file.name, contentType)
        if (prep.error || !prep.uploadUrl) {
          setProgress((p) => ({ ...p, [file.name]: 'error' }))
          return
        }
        const putRes = await fetch(prep.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: file,
        })
        if (!putRes.ok) {
          setProgress((p) => ({ ...p, [file.name]: 'error' }))
          return
        }
        const fin = await finalizeReleaseTrack(releaseId, track.id)
        setProgress((p) => ({ ...p, [file.name]: fin.error ? 'error' : 'done' }))
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
        disabled={busy}
      />

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
          if (busy) return
          void filesFromDataTransfer(e.dataTransfer).then(handleFiles)
        }}
        onClick={() => !busy && inputRef.current?.click()}
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
            if (e.target.files?.length) void handleFiles(Array.from(e.target.files))
            e.target.value = ''
          }}
        />
        <div className="upload-entry__drop-icon" aria-hidden>
          {busy ? '…' : '↑'}
        </div>
        <p className="upload-entry__drop-label">
          {busy ? 'Uploading…' : 'Drop a folder of tracks, or select multiple files'}
        </p>
        <p className="upload-entry__drop-formats">
          Track order and titles are taken from filenames — WAV · FLAC · MP3 · AAC · AIFF
        </p>
      </div>

      {Object.keys(progress).length > 0 && (
        <ul className="studio-list studio-mt-sm">
          {Object.entries(progress).map(([name, state]) => (
            <li key={name} className="studio-item-row--list">
              <span className="studio-flex-1 studio-text-sm">{name}</span>
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
          ))}
        </ul>
      )}

      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
    </div>
  )
}
