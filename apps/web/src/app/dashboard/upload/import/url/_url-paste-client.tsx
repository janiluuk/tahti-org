// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
    // Deduplicate by service — keep last URL per service
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
      {/* URL input area */}
      <label className="collection-form__label">
        Paste URLs
        <textarea
          className="collection-form__textarea url-paste__textarea"
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder={
            'https://open.spotify.com/album/…\nhttps://music.apple.com/…\nhttps://youtu.be/…'
          }
          rows={4}
          spellCheck={false}
        />
      </label>

      <button
        type="button"
        className="studio-btn-ghost"
        onClick={handleParse}
        disabled={!rawInput.trim()}
      >
        Detect services
      </button>

      {/* Parsed entries */}
      {entries.length > 0 && (
        <div className="url-paste__entries">
          {entries.map((e, idx) => (
            <div key={idx} className="url-paste__entry">
              <span className="url-paste__service">
                {e.service ? SERVICE_LABELS[e.service] : '?'}
              </span>
              <span className="url-paste__url" title={e.url}>
                {e.url.length > 50 ? `${e.url.slice(0, 50)}…` : e.url}
              </span>
              {!e.service && (
                <input
                  className="collection-form__input url-paste__label-input"
                  type="text"
                  placeholder="Service name (e.g. tidal)"
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

      {/* Title */}
      {entries.length > 0 && (
        <label className="collection-form__label">
          Title
          <input
            className="collection-form__input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. My Album"
            maxLength={200}
            autoFocus
          />
        </label>
      )}

      {error && <p className="collection-form__error">{error}</p>}

      {entries.length > 0 && (
        <div className="collection-form__actions">
          <button
            type="button"
            className="studio-btn-primary"
            onClick={() => void handleSubmit()}
            disabled={saving || !title.trim()}
          >
            {saving ? 'Creating…' : 'Create smart link →'}
          </button>
        </div>
      )}
    </div>
  )
}
