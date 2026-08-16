// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import type { TrackCredit } from '@tahti/shared'
import { TRACK_CREDIT_ROLE_PRESETS } from '@tahti/shared'
import { Button, ButtonIcon } from '@tahti/ui'
import { updateReleaseTrackCredits } from './release-actions'

const OTHER_ROLE = '__other__'
const EMPTY_CREDIT: TrackCredit = { role: 'vocals', name: '' }

export function parseTrackCredits(value: unknown): TrackCredit[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (row): row is TrackCredit =>
      Boolean(row) &&
      typeof row === 'object' &&
      typeof (row as TrackCredit).role === 'string' &&
      (row as TrackCredit).role.trim().length > 0 &&
      typeof (row as TrackCredit).name === 'string' &&
      (row as TrackCredit).name.trim().length > 0,
  )
}

export function ReleaseTrackCreditsPanel({
  releaseId,
  trackId,
  trackTitle,
  initialCredits,
}: {
  releaseId: string
  trackId: string
  trackTitle: string
  initialCredits: TrackCredit[]
}) {
  const [credits, setCredits] = useState<TrackCredit[]>(initialCredits)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function save() {
    setError(null)
    setSaved(false)
    const trimmed = credits
      .map((c) => ({ ...c, role: c.role.trim(), name: c.name.trim() }))
      .filter((c) => c.role && c.name)
    startTransition(async () => {
      const res = await updateReleaseTrackCredits(releaseId, trackId, trimmed)
      if (res.error) {
        setError(res.error)
        return
      }
      setCredits(trimmed)
      setSaved(true)
    })
  }

  return (
    <details className="studio-details studio-mt-sm studio-text-sm">
      <summary>Credits — {trackTitle}</summary>
      {credits.length === 0 && (
        <p className="studio-empty">
          Optional — add who played what on this track (vocals, guitars, ...).
        </p>
      )}
      <ul className="studio-list studio-mb-sm">
        {credits.map((credit, index) => {
          const isPreset = (TRACK_CREDIT_ROLE_PRESETS as readonly string[]).includes(credit.role)
          return (
            <li key={index} className="studio-grid studio-grid--credits">
              <select
                value={isPreset ? credit.role : OTHER_ROLE}
                onChange={(e) => {
                  const next = [...credits]
                  const value = e.target.value
                  next[index] = { ...credit, role: value === OTHER_ROLE ? '' : value }
                  setCredits(next)
                }}
                className="studio-input"
                aria-label="Credit role"
              >
                {TRACK_CREDIT_ROLE_PRESETS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
                <option value={OTHER_ROLE}>Other…</option>
              </select>
              {!isPreset && (
                <input
                  value={credit.role}
                  placeholder="Role"
                  maxLength={40}
                  onChange={(e) => {
                    const next = [...credits]
                    next[index] = { ...credit, role: e.target.value }
                    setCredits(next)
                  }}
                  className="studio-input"
                  aria-label="Custom role"
                />
              )}
              <input
                value={credit.name}
                placeholder="Name"
                maxLength={120}
                onChange={(e) => {
                  const next = [...credits]
                  next[index] = { ...credit, name: e.target.value }
                  setCredits(next)
                }}
                className="studio-input"
                aria-label="Credit name"
              />
              <input
                value={credit.artistUsername ? `@${credit.artistUsername}` : ''}
                placeholder="@username"
                maxLength={33}
                onChange={(e) => {
                  const raw = e.target.value.trim().replace(/^@/, '').toLowerCase()
                  const next = [...credits]
                  next[index] = {
                    ...credit,
                    artistUsername: raw.length > 0 ? raw : undefined,
                  }
                  setCredits(next)
                }}
                className="studio-input"
                aria-label="Tahti username"
              />
              <Button
                onClick={() => setCredits(credits.filter((_, i) => i !== index))}
                variant="ghost"
              >
                <ButtonIcon name="trash" />
                Remove
              </Button>
            </li>
          )
        })}
      </ul>
      <div className="studio-row studio-row--wrap studio-gap-xs">
        <Button
          disabled={credits.length >= 20}
          onClick={() => setCredits([...credits, { ...EMPTY_CREDIT }])}
          variant="ghost"
        >
          <ButtonIcon name="plus" />
          Add credit
        </Button>
        <Button onClick={save} disabled={isPending} variant="primary" size="sm">
          <ButtonIcon name="save" />
          {isPending ? 'Saving…' : 'Save'}
        </Button>
        {saved && <span className="studio-text-muted-sm">Saved.</span>}
      </div>
      {error && <p className="studio-text-error">{error}</p>}
    </details>
  )
}
