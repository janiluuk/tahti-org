// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ButtonIcon, StatusPill, Button } from '@tahti/ui'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''

type ScTrack = {
  id: string
  title: string
  durationMs: number
}

type ImportJob = {
  id: string
  fileName: string | null
  status: string
  error: string | null
  archiveItemId: string | null
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${String(rem).padStart(2, '0')}`
}

function statusLabel(status: string): string {
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

function statusTone(status: string): 'green' | 'amber' | 'coral' | 'cyan' {
  if (status === 'DONE') return 'green'
  if (status === 'FAILED') return 'coral'
  if (status === 'DOWNLOADING' || status === 'QUEUED') return 'amber'
  return 'cyan'
}

export function SoundCloudImportPanel({ tracks }: { tracks: ScTrack[] }) {
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [importingId, setImportingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshJobs = useCallback(async () => {
    const res = await fetch(`${apiUrl}/api/me/cloud-import/jobs`, { credentials: 'include' })
    if (!res.ok) return
    const data = (await res.json()) as { jobs?: ImportJob[] }
    setJobs((data.jobs ?? []).filter((j) => j.fileName != null))
  }, [])

  useEffect(() => {
    void refreshJobs()
  }, [refreshJobs])

  useEffect(() => {
    const active = jobs.some((j) => j.status === 'QUEUED' || j.status === 'DOWNLOADING')
    if (!active) return
    const timer = window.setInterval(() => void refreshJobs(), 2500)
    return () => window.clearInterval(timer)
  }, [jobs, refreshJobs])

  const importedTitles = new Set(jobs.filter((j) => j.status !== 'FAILED').map((j) => j.fileName))

  async function importTrack(track: ScTrack) {
    setImportingId(track.id)
    setError(null)
    try {
      const res = await fetch(`${apiUrl}/api/me/soundcloud/import`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: [{ trackId: track.id, title: track.title }] }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Import request failed')
      }
      await refreshJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImportingId(null)
    }
  }

  return (
    <>
      {error ? <p className="import-connect__note import-connect__note--error">{error}</p> : null}
      <ol className="import-page__track-list">
        {tracks.map((t) => {
          const job = jobs.find((j) => j.fileName === t.title)
          const alreadyQueued = importedTitles.has(t.title)
          return (
            <li key={t.id} className="import-page__track-row">
              <div className="import-page__track-info">
                <span className="import-page__track-name">{t.title}</span>
                <span className="import-page__track-meta">{formatDuration(t.durationMs)}</span>
                {job?.error ? (
                  <span className="import-page__track-meta import-page__track-meta--error">
                    {job.error}
                  </span>
                ) : null}
              </div>
              {job ? (
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
              ) : (
                <Button
                  onClick={() => void importTrack(t)}
                  disabled={importingId === t.id || alreadyQueued}
                  variant="ghost"
                  size="sm"
                >
                  <ButtonIcon name="import" />
                  {importingId === t.id ? 'Queueing…' : 'Import'}
                </Button>
              )}
            </li>
          )
        })}
      </ol>
    </>
  )
}
