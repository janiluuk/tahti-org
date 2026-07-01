// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ButtonIcon, StatusPill } from '@tahti/ui'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''

type PickerDoc = {
  id: string
  name: string
  mimeType: string
}

type ImportJob = {
  id: string
  fileName: string | null
  status: string
  error: string | null
  archiveItemId: string | null
}

type PickerCallbackData = {
  action: string
  docs?: PickerDoc[]
}

type GooglePickerView = {
  setMimeTypes: (m: string) => GooglePickerView
  setIncludeFolders: (v: boolean) => GooglePickerView
}

type GooglePickerBuilder = {
  addView: (v: GooglePickerView) => GooglePickerBuilder
  setOAuthToken: (t: string) => GooglePickerBuilder
  setDeveloperKey: (k: string) => GooglePickerBuilder
  setCallback: (cb: (data: PickerCallbackData) => void) => GooglePickerBuilder
  build: () => { setVisible: (v: boolean) => void }
}

type GapiWindow = Window & {
  gapi?: { load: (name: string, cb: () => void) => void }
  google?: {
    picker: {
      Action: { PICKED: string }
      DocsView: new (viewId?: unknown) => GooglePickerView
      ViewId: { DOCS: unknown }
      PickerBuilder: new () => GooglePickerBuilder
    }
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

async function loadPickerApi(): Promise<void> {
  await loadScript('https://apis.google.com/js/api.js')
  const gapiWindow = window as GapiWindow
  await new Promise<void>((resolve, reject) => {
    if (!gapiWindow.gapi) {
      reject(new Error('Google API failed to load'))
      return
    }
    gapiWindow.gapi.load('picker', () => resolve())
  })
}

const AUDIO_MIMES =
  'audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/mp4,audio/aac,audio/ogg,audio/webm,audio/vnd.wave'

export function GoogleDrivePickerPanel({ connected }: { connected: boolean }) {
  const [opening, setOpening] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<ImportJob[]>([])

  const refreshJobs = useCallback(async () => {
    const res = await fetch(`${apiUrl}/api/me/cloud-import/jobs`, { credentials: 'include' })
    if (!res.ok) return
    const data = (await res.json()) as { jobs?: ImportJob[] }
    setJobs(data.jobs ?? [])
  }, [])

  useEffect(() => {
    if (!connected) return
    void refreshJobs()
  }, [connected, refreshJobs])

  useEffect(() => {
    if (!connected) return
    const active = jobs.some((j) => j.status === 'QUEUED' || j.status === 'DOWNLOADING')
    if (!active) return
    const timer = window.setInterval(() => void refreshJobs(), 2500)
    return () => window.clearInterval(timer)
  }, [connected, jobs, refreshJobs])

  const queueImport = async (files: PickerDoc[]) => {
    setImporting(true)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/me/google-drive/import`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: files.map((f) => ({ fileId: f.id, name: f.name, mimeType: f.mimeType })),
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Import request failed')
      }
      await refreshJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const openPicker = async () => {
    setOpening(true)
    setError(null)
    try {
      const configRes = await fetch(`${apiUrl}/api/me/google-drive/picker-config`, {
        credentials: 'include',
      })
      if (!configRes.ok) {
        const body = (await configRes.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Could not load Google Picker configuration')
      }
      const pickerConfig = (await configRes.json()) as {
        clientId: string
        developerKey: string
        accessToken: string
      }

      await loadPickerApi()
      const g = (window as GapiWindow).google
      if (!g?.picker) throw new Error('Google Picker API unavailable')

      const view = new g.picker.DocsView(g.picker.ViewId.DOCS)
        .setIncludeFolders(false)
        .setMimeTypes(AUDIO_MIMES)

      const picker = new g.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(pickerConfig.accessToken)
        .setDeveloperKey(pickerConfig.developerKey)
        .setCallback((data) => {
          if (data.action === g.picker.Action.PICKED && data.docs?.length) {
            void queueImport(data.docs)
          }
        })
        .build()

      picker.setVisible(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open Google Drive picker')
    } finally {
      setOpening(false)
    }
  }

  if (!connected) return null

  const statusLabel = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return 'Queued'
      case 'DOWNLOADING':
        return 'Downloading…'
      case 'DONE':
        return 'Imported'
      case 'FAILED':
        return 'Failed'
      default:
        return status
    }
  }

  const statusTone = (status: string): 'green' | 'amber' | 'coral' | 'cyan' => {
    if (status === 'DONE') return 'green'
    if (status === 'FAILED') return 'coral'
    if (status === 'DOWNLOADING' || status === 'QUEUED') return 'amber'
    return 'cyan'
  }

  return (
    <div className="import-drive">
      <p className="import-connect__note">
        Pick one or more audio files from your Google Drive. Tahti downloads them server-side and
        queues transcoding — nothing passes through your browser disk.
      </p>
      <button
        type="button"
        className="ui-btn ui-btn--primary"
        onClick={() => void openPicker()}
        disabled={opening || importing}
      >
        <ButtonIcon name="import" />
        {opening ? 'Opening picker…' : importing ? 'Queueing import…' : 'Choose files from Drive'}
      </button>
      {error ? <p className="import-connect__note import-connect__note--error">{error}</p> : null}

      {jobs.length > 0 ? (
        <ol className="import-page__track-list import-drive__jobs">
          {jobs.map((job) => (
            <li key={job.id} className="import-page__track-row">
              <div className="import-page__track-info">
                <span className="import-page__track-name">{job.fileName ?? 'Audio file'}</span>
                {job.error ? (
                  <span className="import-page__track-meta import-page__track-meta--error">
                    {job.error}
                  </span>
                ) : null}
              </div>
              <div className="import-drive__job-actions">
                <StatusPill tone={statusTone(job.status)}>{statusLabel(job.status)}</StatusPill>
                {job.status === 'DONE' && job.archiveItemId ? (
                  <Link
                    href={`/dashboard/archive/${job.archiveItemId}/editor`}
                    className="ui-btn ui-btn--ghost ui-btn--sm"
                  >
                    Open in editor →
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
