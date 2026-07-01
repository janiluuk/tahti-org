// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ButtonIcon, SidebarNavIconSvg } from '@tahti/ui'
import type { CollectionOption } from '../upload-actions'
import { finaliseUpload } from '../upload-actions'
import { getPendingUpload, clearPendingUpload } from '../_pending-uploads'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

interface TaggedMeta {
  title?: string
  artist?: string
  year?: number
  genre?: string
  coverDataUrl?: string
  durationSec?: number
  isLossless?: boolean
  codec?: string
  fromTag: Set<string>
}

async function extractTags(file: File): Promise<TaggedMeta> {
  try {
    const { parseBlob } = await import('music-metadata')
    // Only read first 1 MB — tags are in the file header
    const slice = file.slice(0, 1024 * 1024)
    const sliceFile = new File([slice], file.name, { type: file.type })
    const meta = await parseBlob(sliceFile, { skipCovers: false })

    const fromTag = new Set<string>()
    const result: TaggedMeta = { fromTag }

    if (meta.common.title) {
      result.title = meta.common.title
      fromTag.add('title')
    }
    if (meta.common.artist) {
      result.artist = meta.common.artist
      fromTag.add('artist')
    }
    if (meta.common.year) {
      result.year = meta.common.year
      fromTag.add('year')
    }
    if (meta.common.genre?.[0]) {
      result.genre = meta.common.genre[0]
      fromTag.add('genre')
    }
    if (meta.format.duration) result.durationSec = Math.round(meta.format.duration)
    if (meta.format.lossless !== undefined) result.isLossless = meta.format.lossless
    if (meta.format.codec) result.codec = meta.format.codec

    // Extract cover art — decode to thumbnail to avoid rendering huge jpegs
    const pic = meta.common.picture?.[0]
    if (pic) {
      const blob = new Blob([pic.data as BlobPart], { type: pic.format })
      const url = URL.createObjectURL(blob)
      const img = await createImageBitmap(blob, { resizeWidth: 200, resizeHeight: 200 })
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      img.close()
      URL.revokeObjectURL(url)
      result.coverDataUrl = canvas.toDataURL('image/jpeg', 0.85)
    }

    return result
  } catch {
    return { fromTag: new Set() }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
}

const CONTENT_TYPES = ['track', 'set'] as const
type ContentType = (typeof CONTENT_TYPES)[number]

export function UploadInProgress({
  uploadId,
  collectionOptions,
}: {
  uploadId: string
  collectionOptions: CollectionOption[]
}) {
  const router = useRouter()
  const pending = getPendingUpload(uploadId)

  const [tags, setTags] = useState<TaggedMeta | null>(null)
  const [tagsLoading, setTagsLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [year, setYear] = useState('')
  const [genre, setGenre] = useState('')
  const [contentType, setContentType] = useState<ContentType>('track')
  const [selectedCollections, setSelectedCollections] = useState<string[]>([])
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null)

  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedBytes, setUploadedBytes] = useState(0)
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null)
  const [uploadState, setUploadState] = useState<
    'waiting' | 'uploading' | 'completing' | 'transcoding' | 'done' | 'error' | 'no-file'
  >('waiting')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [itemId, setItemId] = useState<string | null>(null)

  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const startTimeRef = useRef<number>(0)
  const throughputRef = useRef<number[]>([]) // rolling window of bytes/sec

  // Extract tags and start upload on mount
  useEffect(() => {
    if (!pending) {
      setUploadState('no-file')
      setTagsLoading(false)
      return
    }
    void (async () => {
      setTagsLoading(true)
      const meta = await extractTags(pending.file)
      setTags(meta)
      if (meta.title) setTitle(meta.title)
      if (meta.artist) setArtist(meta.artist)
      if (meta.year) setYear(String(meta.year))
      if (meta.genre) setGenre(meta.genre)
      if (meta.coverDataUrl) setCoverDataUrl(meta.coverDataUrl)
      // Auto-detect content type: set if duration ≥ 20 min and no year tag
      if (meta.durationSec && meta.durationSec >= 1200 && !meta.fromTag.has('year')) {
        setContentType('set')
      }
      setTagsLoading(false)

      // Start upload immediately after tags extracted
      startUpload(pending.file, pending.uploadUrl)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])

  function startUpload(file: File, uploadUrl: string) {
    setUploadState('uploading')
    startTimeRef.current = Date.now()
    throughputRef.current = []
    let lastLoaded = 0
    let lastTime = Date.now()

    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr

    xhr.upload.addEventListener('progress', (ev) => {
      if (!ev.lengthComputable) return
      setUploadProgress(Math.round((ev.loaded / ev.total) * 100))
      setUploadedBytes(ev.loaded)

      // Rolling 5-second throughput window
      const now = Date.now()
      const elapsed = (now - lastTime) / 1000
      if (elapsed > 0.5) {
        const bytesPerSec = (ev.loaded - lastLoaded) / elapsed
        throughputRef.current.push(bytesPerSec)
        if (throughputRef.current.length > 10) throughputRef.current.shift()
        lastLoaded = ev.loaded
        lastTime = now
        const avgBps =
          throughputRef.current.reduce((a, b) => a + b, 0) / throughputRef.current.length
        if (avgBps > 0) {
          setEtaSeconds((ev.total - ev.loaded) / avgBps)
        }
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = (xhr.getResponseHeader('ETag') ?? xhr.getResponseHeader('etag') ?? '').replace(
          /"/g,
          '',
        )
        void handleComplete(etag)
      } else {
        setUploadState('error')
        setErrorMsg(`Upload failed (HTTP ${xhr.status})`)
      }
    })

    xhr.addEventListener('error', () => {
      setUploadState('error')
      setErrorMsg('Network error during upload')
    })

    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type || 'audio/flac')
    xhr.send(file)
  }

  const handleComplete = useCallback(
    async (etag: string) => {
      setUploadState('completing')
      const result = await finaliseUpload({
        uploadId,
        etag,
        title: title || 'Untitled',
        artist: artist || undefined,
        year: year ? Number(year) : undefined,
        genre: genre || undefined,
        collectionSlugs: selectedCollections,
        source: pending?.source,
      })
      if (result.error) {
        setUploadState('error')
        setErrorMsg(result.error)
        return
      }
      clearPendingUpload(uploadId)
      setItemId(result.itemId)
      setUploadState('transcoding')
      // Poll for READY
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        try {
          const res = await fetch(`${API_BASE}/api/me/archive/${result.itemId}`, {
            credentials: 'include',
          })
          if (res.ok) {
            const data = (await res.json()) as { status: string }
            if (data.status === 'READY') {
              setUploadState('done')
              return
            }
            if (data.status === 'ERROR') {
              setUploadState('error')
              setErrorMsg('Transcoding failed')
              return
            }
          }
        } catch {
          // continue polling
        }
      }
      setUploadState('done') // timeout — assume done
    },
    [uploadId, title, artist, year, genre, selectedCollections, pending?.source],
  )

  const cancel = useCallback(() => {
    xhrRef.current?.abort()
    clearPendingUpload(uploadId)
    router.push('/dashboard/upload')
  }, [uploadId, router])

  if (uploadState === 'no-file') {
    return (
      <div className="upload-progress-page">
        <div className="upload-progress__header">
          <Link href="/dashboard/upload" className="upload-progress__back">
            ← Upload
          </Link>
        </div>
        <div className="upload-progress__no-file">
          <p>No upload in progress for this ID.</p>
          <p className="studio-muted">The file may have been lost on page refresh.</p>
          <Link href="/dashboard/upload" className="ui-btn ui-btn--primary">
            <SidebarNavIconSvg name="upload" />
            Start a new upload
          </Link>
        </div>
      </div>
    )
  }

  const isDone = uploadState === 'done'
  const isError = uploadState === 'error'
  const isActive = ['uploading', 'completing', 'transcoding'].includes(uploadState)
  const canPublish = isDone && !!itemId
  const canSubmitForm = !isActive && !isDone
  const fileName = pending?.file.name ?? uploadId.split('/').pop() ?? 'audio'

  return (
    <div className="upload-progress-page">
      <div className="upload-progress__header">
        <Link href="/dashboard/upload" className="upload-progress__back">
          ← Upload
        </Link>
        <h1 className="upload-progress__filename">{fileName}</h1>
      </div>

      <div className="upload-progress__layout">
        {/* ── Left: cover + progress ── */}
        <aside className="upload-progress__aside">
          <div className="upload-progress__cover">
            {coverDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverDataUrl} alt="Cover" className="upload-progress__cover-img" />
            ) : (
              <div className="upload-progress__cover-placeholder" aria-hidden />
            )}
          </div>

          <div className="upload-progress__progress-area">
            {uploadState === 'uploading' && (
              <>
                <div className="upload-progress__bar-wrap">
                  <div
                    className="upload-progress__bar-fill"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="upload-progress__stats">
                  <span>{uploadProgress}%</span>
                  {pending && (
                    <span>
                      {formatBytes(uploadedBytes)} / {formatBytes(pending.file.size)}
                    </span>
                  )}
                  {etaSeconds !== null && <span>ETA {formatEta(etaSeconds)}</span>}
                </div>
                <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={cancel}>
                  Cancel
                </button>
              </>
            )}
            {uploadState === 'completing' && (
              <p className="upload-progress__status">Registering upload…</p>
            )}
            {uploadState === 'transcoding' && (
              <p className="upload-progress__status">Processing audio…</p>
            )}
            {isDone && (
              <p className="upload-progress__status upload-progress__status--ok">✓ Ready</p>
            )}
            {isError && (
              <p className="upload-progress__status upload-progress__status--err">
                {errorMsg ?? 'Upload failed'}
              </p>
            )}
          </div>

          {/* file info from tags */}
          {tags && !tagsLoading && (
            <dl className="upload-progress__file-info">
              {tags.codec && (
                <>
                  <dt>Format</dt>
                  <dd>
                    {tags.codec}
                    {tags.isLossless ? ' · lossless' : ''}
                  </dd>
                </>
              )}
              {tags.durationSec && (
                <>
                  <dt>Duration</dt>
                  <dd>
                    {Math.floor(tags.durationSec / 60)}m {tags.durationSec % 60}s
                  </dd>
                </>
              )}
              {pending && (
                <>
                  <dt>Size</dt>
                  <dd>{formatBytes(pending.file.size)}</dd>
                </>
              )}
            </dl>
          )}
        </aside>

        {/* ── Right: metadata form ── */}
        <div className="upload-progress__form">
          <div className="upload-progress__field">
            <label className="upload-progress__label">
              Title
              {tags?.fromTag.has('title') && (
                <span className="upload-progress__tag-chip">✓ from tag</span>
              )}
            </label>
            <input
              type="text"
              className="studio-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Track or set title"
              disabled={canSubmitForm === false && !isDone}
            />
          </div>

          <div className="upload-progress__field">
            <label className="upload-progress__label">
              Artist
              {tags?.fromTag.has('artist') && (
                <span className="upload-progress__tag-chip">✓ from tag</span>
              )}
            </label>
            <input
              type="text"
              className="studio-input"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              maxLength={200}
              placeholder="Artist name"
            />
          </div>

          <div className="upload-progress__row">
            <div className="upload-progress__field">
              <label className="upload-progress__label">
                Year
                {tags?.fromTag.has('year') && (
                  <span className="upload-progress__tag-chip">✓ from tag</span>
                )}
              </label>
              <input
                type="number"
                className="studio-input"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min={1900}
                max={2099}
                placeholder="2026"
              />
            </div>

            <div className="upload-progress__field">
              <label className="upload-progress__label">
                Genre
                {tags?.fromTag.has('genre') && (
                  <span className="upload-progress__tag-chip">✓ from tag</span>
                )}
              </label>
              <input
                type="text"
                className="studio-input"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                maxLength={100}
                placeholder="Techno, Ambient…"
              />
            </div>
          </div>

          <div className="upload-progress__field">
            <label className="upload-progress__label">Type</label>
            <div className="upload-progress__seg" role="group">
              {CONTENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`upload-progress__seg-btn${contentType === t ? ' upload-progress__seg-btn--active' : ''}`}
                  onClick={() => setContentType(t)}
                >
                  {t === 'track' ? 'Track' : 'Set / Mix'}
                </button>
              ))}
            </div>
          </div>

          {collectionOptions.length > 0 && (
            <div className="upload-progress__field">
              <label className="upload-progress__label">Add to collection</label>
              <div className="upload-progress__collection-list">
                {collectionOptions.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    className={`upload-progress__collection-chip${selectedCollections.includes(c.slug) ? ' upload-progress__collection-chip--active' : ''}`}
                    onClick={() =>
                      setSelectedCollections((prev) =>
                        prev.includes(c.slug)
                          ? prev.filter((s) => s !== c.slug)
                          : [...prev, c.slug],
                      )
                    }
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer actions ── */}
      <div className="upload-progress__footer">
        {canPublish ? (
          <>
            <Link href={`/dashboard/archive/${itemId}`} className="ui-btn ui-btn--ghost ui-btn--sm">
              View in archive
            </Link>
            <Link href="/dashboard/releases" className="ui-btn ui-btn--ghost ui-btn--sm">
              Add smart links →
            </Link>
            <Link href={`/dashboard/archive/${itemId}/editor`} className="ui-btn ui-btn--primary">
              <ButtonIcon name="send" />
              Polish & publish →
            </Link>
          </>
        ) : (
          <>
            <Link href="/dashboard/upload" className="ui-btn ui-btn--ghost ui-btn--sm">
              Add another file
            </Link>
            <button
              type="button"
              className="ui-btn ui-btn--primary"
              disabled={isActive || tagsLoading}
              title={isActive ? 'Upload in progress' : ''}
            >
              <ButtonIcon name="save" />
              {isActive ? 'Upload in progress…' : 'Save as draft'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
