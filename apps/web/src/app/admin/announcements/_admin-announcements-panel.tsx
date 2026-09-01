// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { brandTokens, ButtonIcon, FileDropzone } from '@tahti/ui'
import {
  completeSystemAnnouncementUpload,
  deleteSystemAnnouncement,
  fetchSystemAnnouncementEditorSource,
  patchSystemAnnouncement,
  prepareSystemAnnouncementUpload,
  setSystemAnnouncementsEnabled,
  type AdminAnnouncementClipRow,
} from './actions'

function formatDuration(sec: number | null): string {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function AdminAnnouncementsPanel({
  initialClips,
  initialSystemEnabled,
}: {
  initialClips: AdminAnnouncementClipRow[]
  initialSystemEnabled: boolean
}) {
  const [clips, setClips] = useState(initialClips)
  const [systemEnabled, setSystemEnabledState] = useState(initialSystemEnabled)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  async function onTogglePreview(clip: AdminAnnouncementClipRow) {
    if (previewId === clip.id) {
      setPreviewId(null)
      setPreviewUrl(null)
      return
    }
    setPreviewId(clip.id)
    setPreviewUrl(null)
    const source = await fetchSystemAnnouncementEditorSource(clip.id)
    if ('error' in source) {
      setError(source.error)
      setPreviewId(null)
      return
    }
    setPreviewUrl(source.url)
  }

  async function onToggleSystemEnabled() {
    const next = !systemEnabled
    setSystemEnabledState(next)
    const { error: toggleError } = await setSystemAnnouncementsEnabled(next)
    if (toggleError) {
      setSystemEnabledState(!next)
      setError(toggleError)
    }
  }

  async function onFile(file: File) {
    setError(null)
    setUploading(true)
    try {
      const title = file.name.replace(/\.[^.]+$/, '')
      const prep = await prepareSystemAnnouncementUpload(file.name, file.type, file.size, title)
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
      const { clip, error: completeError } = await completeSystemAnnouncementUpload(
        prep.uploadId,
        title,
      )
      if (completeError || !clip) {
        setError(completeError ?? 'Could not save announcement')
        return
      }
      setClips((prev) => [clip, ...prev])
    } finally {
      setUploading(false)
    }
  }

  async function onPatch(id: string, patch: Partial<AdminAnnouncementClipRow>) {
    const prev = clips
    setClips((cur) => cur.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    const { clip, error: patchError } = await patchSystemAnnouncement(id, patch)
    if (patchError || !clip) {
      setClips(prev)
      setError(patchError ?? 'Could not save')
      return
    }
    setClips((cur) => cur.map((c) => (c.id === id ? clip : c)))
  }

  async function onDelete(id: string) {
    const prev = clips
    setClips((c) => c.filter((clip) => clip.id !== id))
    const { error: deleteError } = await deleteSystemAnnouncement(id)
    if (deleteError) {
      setClips(prev)
      setError(deleteError)
    }
  }

  return (
    <>
      <div
        style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          border: '1px solid var(--admin-border)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div>
          <p className="admin-stat-sub" style={{ margin: 0 }}>
            System announcements are interleaved into every channel&apos;s rotation (subject to each
            clip&apos;s own on/off + schedule below). Turning this off stops all system
            announcements everywhere, instantly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onToggleSystemEnabled()}
          className={`admin-btn admin-btn--sm ${systemEnabled ? '' : 'admin-btn--danger'}`}
        >
          {systemEnabled ? 'On — click to disable' : 'Off — click to enable'}
        </button>
      </div>

      <FileDropzone
        label="Choose an announcement clip"
        hint="Audio file"
        selectedText={selectedFile?.name}
        accept="audio/*"
        disabled={uploading}
        className="admin-mb-md"
        onFiles={([file]) => {
          if (!file) return
          setSelectedFile(file)
          void onFile(file).finally(() => setSelectedFile(null))
        }}
      />
      {uploading && <p className="admin-stat-sub">Uploading…</p>}
      {error && (
        <p className="admin-stat-sub" style={{ color: brandTokens.color.semantic.danger }}>
          {error}
        </p>
      )}

      {clips.length === 0 ? (
        <p className="admin-stat-sub">No system announcement clips yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Duration</th>
                <th>On</th>
                <th>Schedule</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clips.map((clip) => (
                <tr key={clip.id}>
                  <td>{clip.title}</td>
                  <td style={{ opacity: 0.6, fontSize: '0.85rem' }}>
                    {formatDuration(clip.durationSec)}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={clip.isEnabled}
                      onChange={() => void onPatch(clip.id, { isEnabled: !clip.isEnabled })}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <select
                        value={clip.scheduleMode}
                        onChange={(e) => {
                          const scheduleMode = e.target
                            .value as AdminAnnouncementClipRow['scheduleMode']
                          void onPatch(clip.id, {
                            scheduleMode,
                            everyNth: scheduleMode === 'EVERY_NTH' ? (clip.everyNth ?? 4) : null,
                          })
                        }}
                        className="admin-search-input"
                        style={{ fontSize: '0.85rem', padding: '0.25rem 0.4rem' }}
                      >
                        <option value="AFTER_EVERY">After every clip</option>
                        <option value="EVERY_NTH">Every Nth clip</option>
                        <option value="RANDOM">Randomly</option>
                      </select>
                      {clip.scheduleMode === 'EVERY_NTH' && (
                        <input
                          type="number"
                          min={2}
                          max={100}
                          value={clip.everyNth ?? 4}
                          onChange={(e) =>
                            void onPatch(clip.id, { everyNth: Number(e.target.value) })
                          }
                          className="admin-search-input"
                          style={{ width: '60px', fontSize: '0.85rem', padding: '0.25rem 0.4rem' }}
                        />
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm"
                        title="Preview"
                        aria-label={`Preview "${clip.title}"`}
                        onClick={() => void onTogglePreview(clip)}
                      >
                        <ButtonIcon name="play" />
                      </button>
                      <Link
                        href={`/admin/announcements/editor/${clip.id}`}
                        className="admin-btn admin-btn--sm"
                        title="Edit"
                        aria-label={`Edit "${clip.title}"`}
                      >
                        <ButtonIcon name="edit" />
                      </Link>
                      <button
                        type="button"
                        className="admin-btn admin-btn--danger admin-btn--sm"
                        onClick={() => void onDelete(clip.id)}
                      >
                        Delete
                      </button>
                      {previewId === clip.id && previewUrl && (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <audio src={previewUrl} controls autoPlay style={{ height: '28px' }} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
