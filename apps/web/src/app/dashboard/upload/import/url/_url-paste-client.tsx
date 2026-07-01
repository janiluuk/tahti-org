// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ButtonIcon } from '@tahti/ui'
import { createSmartLinkEntry } from '../../../release-actions'

type Service =
  | 'spotify'
  | 'apple'
  | 'youtube'
  | 'tidal'
  | 'bandcamp'
  | 'soundcloud'
  | 'deezer'
  | 'amazon'

const SERVICE_LABELS: Record<Service, string> = {
  spotify: 'Spotify',
  apple: 'Apple Music',
  youtube: 'YouTube',
  tidal: 'Tidal',
  bandcamp: 'Bandcamp',
  soundcloud: 'SoundCloud',
  deezer: 'Deezer',
  amazon: 'Amazon Music',
}

const DOMAIN_MAP: Array<[RegExp, Service]> = [
  [/open\.spotify\.com/i, 'spotify'],
  [/music\.apple\.com/i, 'apple'],
  [/youtube\.com|youtu\.be/i, 'youtube'],
  [/tidal\.com/i, 'tidal'],
  [/bandcamp\.com/i, 'bandcamp'],
  [/soundcloud\.com/i, 'soundcloud'],
  [/deezer\.com/i, 'deezer'],
  [/music\.amazon\.|amazon\.com\/music/i, 'amazon'],
]

function detectService(url: string): Service | null {
  for (const [pattern, service] of DOMAIN_MAP) {
    if (pattern.test(url)) return service
  }
  return null
}

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

interface UrlEntry {
  url: string
  service: Service | null
  label: string
}

function parseEntry(raw: string): UrlEntry | null {
  const url = raw.trim()
  if (!url || !isValidHttpUrl(url)) return null
  return { url, service: detectService(url), label: '' }
}

export function UrlPasteClient() {
  const router = useRouter()
  const [rawInput, setRawInput] = useState('')
  const [entries, setEntries] = useState<UrlEntry[]>([])
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleParse = useCallback(() => {
    const lines = rawInput
      .split(/[\n,]+/)
      .map((l) => l.trim())
      .filter(Boolean)
    const parsed = lines.map(parseEntry).filter((e): e is UrlEntry => e !== null)
    const byService = new Map<string, UrlEntry>()
    for (const e of parsed) {
      const key = e.service ?? e.url
      byService.set(key, e)
    }
    setEntries([...byService.values()])
    setError(null)
  }, [rawInput])

  const removeEntry = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateLabel = (idx: number, label: string) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, label } : e)))
  }

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (entries.length === 0) {
      setError('Add at least one URL')
      return
    }

    const smartLinkTargets: Record<string, string> = {}
    for (const e of entries) {
      if (e.service) smartLinkTargets[e.service] = e.url
    }

    setSaving(true)
    setError(null)
    const { id, error: err } = await createSmartLinkEntry({
      title: title.trim(),
      releaseDate: new Date().toISOString().slice(0, 10),
      smartLinkTargets,
    })
    setSaving(false)
    if (err || !id) {
      setError(err ?? 'Failed to create smart link')
      return
    }
    router.push(`/dashboard`)
  }, [title, entries, router])

  return (
    <div className="url-paste">
      <div className="studio-field">
        <label className="studio-label" htmlFor="url-paste-input">
          Paste URLs
        </label>
        <textarea
          id="url-paste-input"
          className="studio-input url-paste__textarea"
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder={
            'https://open.spotify.com/album/…\nhttps://music.apple.com/…\nhttps://youtu.be/…'
          }
          rows={4}
          spellCheck={false}
        />
      </div>

      <div className="url-paste__actions">
        <button
          type="button"
          className="ui-btn ui-btn--ghost ui-btn--sm"
          onClick={handleParse}
          disabled={!rawInput.trim()}
        >
          Detect services
        </button>
      </div>

      {entries.length > 0 && (
        <div className="url-paste__entries">
          {entries.map((e, idx) => (
            <div key={idx} className="url-paste__entry">
              <span className="url-paste__service">
                {e.service ? SERVICE_LABELS[e.service] : 'Unknown'}
              </span>
              <span className="url-paste__url" title={e.url}>
                {e.url.length > 56 ? `${e.url.slice(0, 56)}…` : e.url}
              </span>
              {!e.service && (
                <input
                  className="studio-input url-paste__label-input"
                  type="text"
                  placeholder="Service name"
                  value={e.label}
                  onChange={(ev) => updateLabel(idx, ev.target.value)}
                />
              )}
              <button
                type="button"
                className="url-paste__remove"
                onClick={() => removeEntry(idx)}
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <div className="studio-field">
          <label className="studio-label" htmlFor="url-paste-title">
            Smart link title
          </label>
          <input
            id="url-paste-title"
            className="studio-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. My Album"
            maxLength={200}
            autoFocus
          />
        </div>
      )}

      {error && <p className="studio-text-error studio-text-sm">{error}</p>}

      {entries.length > 0 && (
        <div className="url-paste__submit">
          <button
            type="button"
            className="ui-btn ui-btn--primary"
            onClick={() => void handleSubmit()}
            disabled={saving || !title.trim()}
          >
            <ButtonIcon name="plus" />
            {saving ? 'Creating…' : 'Create smart link'}
          </button>
        </div>
      )}
    </div>
  )
}
