// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, ButtonIcon } from '@tahti/ui'
import {
  fetchArchiveDownloadUrl,
  fetchArchiveStems,
  requestArchiveStems,
  type StemJobRow,
} from './archive-actions'

const POLL_INTERVAL_MS = 5000

const STEM_SET_LABELS: Record<StemJobRow['stemSet'], string> = {
  TWO_STEM: 'Vocals + instrumental',
  FOUR_STEM: 'Vocals, drums, bass, other',
}

function triggerDownload(url: string, filename?: string) {
  const a = document.createElement('a')
  a.href = url
  if (filename) a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function ArchiveDownloadPanel({ itemId }: { itemId: string }) {
  const [jobs, setJobs] = useState<StemJobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingOriginal, setDownloadingOriginal] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    const result = await fetchArchiveStems(itemId)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setJobs(result.jobs)
    setError(null)
  }, [itemId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await refresh()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId])

  // Poll while anything is in flight — survives a page reload since status
  // comes from the server (ArchiveItemStemJob), not local component state.
  useEffect(() => {
    const inFlight = jobs.some((j) => j.status === 'PENDING' || j.status === 'PROCESSING')
    if (!inFlight) {
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }
    pollRef.current = setInterval(() => void refresh(), POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [jobs, refresh])

  async function onDownloadOriginal() {
    setDownloadingOriginal(true)
    setError(null)
    const result = await fetchArchiveDownloadUrl(itemId)
    setDownloadingOriginal(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    triggerDownload(result.url, result.filename)
  }

  async function onRequestStems(stemSet: StemJobRow['stemSet']) {
    setError(null)
    // Optimistic — flips the button to the grayed-out/processing state
    // immediately rather than waiting for the next poll tick.
    setJobs((prev) => {
      const existing = prev.find((j) => j.stemSet === stemSet)
      if (existing) {
        return prev.map((j) => (j.stemSet === stemSet ? { ...j, status: 'PENDING' } : j))
      }
      return [...prev, { stemSet, status: 'PENDING', errorMessage: null, files: [] }]
    })
    const result = await requestArchiveStems(itemId, stemSet)
    if (result.error) {
      setError(result.error)
      await refresh()
    }
  }

  const jobFor = (stemSet: StemJobRow['stemSet']) => jobs.find((j) => j.stemSet === stemSet)

  return (
    <div className="studio-field--block">
      <span className="studio-label">Download</span>
      <p className="studio-text-muted-sm studio-m-0">
        Original file, or vocal/instrument stems separated in the background — you can navigate away
        and come back later.
      </p>

      <div className="studio-row studio-row--wrap studio-mt-sm">
        <Button
          onClick={() => void onDownloadOriginal()}
          disabled={downloadingOriginal}
          variant="secondary"
          size="sm"
        >
          <ButtonIcon name="download" />
          {downloadingOriginal ? 'Preparing…' : 'Download original'}
        </Button>

        {(['TWO_STEM', 'FOUR_STEM'] as const).map((stemSet) => {
          const job = jobFor(stemSet)
          const isProcessing = job?.status === 'PENDING' || job?.status === 'PROCESSING'
          const isReady = job?.status === 'READY'

          if (isReady) {
            return (
              <div key={stemSet} className="studio-row studio-row--wrap">
                {job!.files.map((file) => (
                  <Button
                    key={file.label}
                    onClick={() => triggerDownload(file.url)}
                    variant="secondary"
                    size="sm"
                  >
                    <ButtonIcon name="download" />
                    {STEM_SET_LABELS[stemSet]} — {file.label}
                  </Button>
                ))}
              </div>
            )
          }

          return (
            <Button
              key={stemSet}
              onClick={() => void onRequestStems(stemSet)}
              disabled={isProcessing || loading}
              variant="secondary"
              size="sm"
            >
              {isProcessing ? (
                <>
                  <span className="studio-spinner" aria-hidden />
                  Separating {STEM_SET_LABELS[stemSet]}…
                </>
              ) : (
                <>
                  <ButtonIcon name="download" />
                  Download stems ({STEM_SET_LABELS[stemSet]})
                </>
              )}
            </Button>
          )
        })}
      </div>

      {jobs.some((j) => j.status === 'ERROR') && (
        <p className="studio-text-error studio-mt-xs">
          Stem separation failed — try again, or contact support if it keeps happening.
        </p>
      )}
      {error && <p className="studio-text-error studio-mt-xs">{error}</p>}
    </div>
  )
}
