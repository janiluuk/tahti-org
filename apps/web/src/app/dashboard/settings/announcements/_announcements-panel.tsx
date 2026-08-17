// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ButtonIcon, FileDropzone, Panel } from '@tahti/ui'
import {
  completeAnnouncementUpload,
  deleteAnnouncement,
  fetchAnnouncementEditorSource,
  prepareAnnouncementUpload,
  setProfileBackgroundClip,
  toggleAnnouncementEnabled,
  type AnnouncementClipRow,
} from './actions'

function formatDuration(sec: number | null): string {
  if (sec == null) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function AnnouncementsPanel({ initialClips }: { initialClips: AnnouncementClipRow[] }) {
  const [clips, setClips] = useState(initialClips)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  async function onTogglePreview(clip: AnnouncementClipRow) {
    if (previewId === clip.id) {
      setPreviewId(null)
      setPreviewUrl(null)
      return
    }
    setPreviewId(clip.id)
    setPreviewUrl(null)
    const source = await fetchAnnouncementEditorSource(clip.id)
    if ('error' in source) {
      setError(source.error)
      setPreviewId(null)
      return
    }
    setPreviewUrl(source.url)
  }

  async function onFile(file: File) {
    setError(null)
    setUploading(true)
    try {
      const title = file.name.replace(/\.[^.]+$/, '')
      const prep = await prepareAnnouncementUpload(file.name, file.type, file.size, title)
      if ('error' in prep) {
        setError(prep.error)
        return
      }
      const put = await fetch(prep.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!put.ok) {
        setError('Upload failed')
        return
      }
      const { clip, error: completeError } = await completeAnnouncementUpload(prep.uploadId, title)
      if (completeError || !clip) {
        setError(completeError ?? 'Could not save announcement')
        return
      }
      setClips((prev) => [clip, ...prev])
    } finally {
      setUploading(false)
    }
  }

  async function onToggle(clip: AnnouncementClipRow) {
    const next = !clip.isEnabled
    setClips((prev) => prev.map((c) => (c.id === clip.id ? { ...c, isEnabled: next } : c)))
    const { error: toggleError } = await toggleAnnouncementEnabled(clip.id, next)
    if (toggleError) {
      setClips((prev) => prev.map((c) => (c.id === clip.id ? { ...c, isEnabled: !next } : c)))
      setError(toggleError)
    }
  }

  async function onDelete(id: string) {
    const prev = clips
    setClips((c) => c.filter((clip) => clip.id !== id))
    const { error: deleteError } = await deleteAnnouncement(id)
    if (deleteError) {
      setClips(prev)
      setError(deleteError)
    }
  }

  async function onSetBackground(clip: AnnouncementClipRow) {
    setError(null)
    const nextId = clip.isProfileBackground ? null : clip.id
    const prev = clips
    setClips((list) =>
      list.map((c) => ({
        ...c,
        isProfileBackground: nextId != null && c.id === nextId,
      })),
    )
    const { error: bgError } = await setProfileBackgroundClip(nextId)
    if (bgError) {
      setClips(prev)
      setError(bgError)
    }
  }

  return (
    <Panel title="Announcements" headerTight>
      <p className="studio-text-muted-sm">
        Short audio clips (station IDs, shoutouts) that play occasionally in your 24/7 rotation.
        Toggle whether they play at all from{' '}
        <a href="/dashboard/channel/playlist" className="studio-link">
          24/7 channel playlist
        </a>
        . Ready clips can also loop as ambient music on your public artist page (muted while
        something else is playing).
      </p>

      <FileDropzone
        accept="audio/*"
        disabled={uploading}
        label={uploading ? 'Uploading…' : 'Drop announcement audio or click'}
        hint="Short station ID, shoutout, or interstitial"
        className="studio-mt-md"
        onFiles={(files) => {
          if (files[0]) void onFile(files[0])
        }}
      />
      {uploading && <p className="studio-text-muted-sm studio-mt-xs">Uploading…</p>}
      {error && <p className="studio-text-error studio-mt-xs">{error}</p>}

      {clips.length === 0 ? (
        <p className="studio-text-muted-sm studio-mt-md">No announcement clips yet.</p>
      ) : (
        <ul className="studio-list studio-mt-md">
          {clips.map((clip) => (
            <li key={clip.id} className="studio-programme-row">
              <span className="studio-programme-label">
                <span>{clip.title}</span>
                {clip.durationSec != null && (
                  <span className="studio-text-muted-sm">{formatDuration(clip.durationSec)}</span>
                )}
              </span>
              <label className="studio-toggle-row">
                <input
                  type="checkbox"
                  className="studio-toggle-checkbox"
                  checked={clip.isEnabled}
                  onChange={() => void onToggle(clip)}
                />
                <span className="studio-toggle-label">{clip.isEnabled ? 'On' : 'Off'}</span>
              </label>
              <button
                type="button"
                className="ui-btn ui-btn--sm ui-btn--ghost"
                title="Preview"
                aria-label={`Preview "${clip.title}"`}
                onClick={() => void onTogglePreview(clip)}
              >
                <ButtonIcon name="play" />
              </button>
              <Link
                href={`/dashboard/settings/announcements/editor/${clip.id}`}
                className="ui-btn ui-btn--sm ui-btn--ghost"
                title="Edit"
                aria-label={`Edit "${clip.title}"`}
              >
                <ButtonIcon name="edit" />
              </Link>
              <button
                type="button"
                className="ui-btn ui-btn--sm ui-btn--ghost"
                title={clip.isProfileBackground ? 'Clear page music' : 'Use as artist page music'}
                aria-label={
                  clip.isProfileBackground
                    ? `Clear "${clip.title}" as page music`
                    : `Use "${clip.title}" as page music`
                }
                disabled={clip.renderStatus !== 'READY'}
                onClick={() => void onSetBackground(clip)}
              >
                {clip.isProfileBackground ? 'Page music ✓' : 'Page music'}
              </button>
              <button
                type="button"
                className="studio-link studio-text-error"
                onClick={() => void onDelete(clip.id)}
              >
                Delete
              </button>
              {previewId === clip.id && previewUrl && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio
                  src={previewUrl}
                  controls
                  autoPlay
                  className="studio-mt-xs"
                  style={{ width: '100%' }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
