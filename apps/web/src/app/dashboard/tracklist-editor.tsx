// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import type { TracklistEntry } from '@tahti/shared'
import { searchTahtiUsers } from './archive-actions'

type Row = { startSec: string; title: string; artist: string }

function rowsFromEntries(entries: TracklistEntry[] | null | undefined): Row[] {
  if (!entries?.length) return [{ startSec: '0', title: '', artist: '' }]
  return entries.map((e) => ({
    startSec: String(e.startSec),
    title: e.title,
    artist: e.artistUsername ? `@${e.artistUsername}` : (e.artist ?? ''),
  }))
}

function entriesFromRows(rows: Row[]): TracklistEntry[] {
  return rows
    .filter((r) => r.title.trim())
    .map((r) => {
      const startSec = Math.max(0, parseInt(r.startSec, 10) || 0)
      const title = r.title.trim()
      const raw = r.artist.trim()
      const mention = raw.match(/^@([a-z0-9_-]{2,32})$/i)
      if (mention) {
        return {
          startSec,
          title,
          artistUsername: mention[1].toLowerCase(),
        }
      }
      return {
        startSec,
        title,
        ...(raw ? { artist: raw } : {}),
      }
    })
}

type SuggestUser = { username: string; displayName: string }

export function TracklistEditor({
  value,
  onChange,
  disabled,
}: {
  value: TracklistEntry[] | null | undefined
  onChange: (next: TracklistEntry[] | null) => void
  disabled?: boolean
}) {
  const [rows, setRows] = useState<Row[]>(() => rowsFromEntries(value))
  const [suggestions, setSuggestions] = useState<SuggestUser[]>([])
  const [activeRow, setActiveRow] = useState<number | null>(null)
  const [, startSearch] = useTransition()

  useEffect(() => {
    setRows(rowsFromEntries(value))
  }, [value])

  const sync = useCallback(
    (next: Row[]) => {
      setRows(next)
      const entries = entriesFromRows(next)
      onChange(entries.length ? entries : null)
    },
    [onChange],
  )

  useEffect(() => {
    const q = activeRow != null ? rows[activeRow]?.artist.replace(/^@/, '') : ''
    if (!q || q.length < 2 || !q.match(/^[a-z0-9_-]*$/i)) {
      setSuggestions([])
      return
    }
    const t = setTimeout(() => {
      startSearch(async () => {
        const data = await searchTahtiUsers(q)
        setSuggestions(data)
      })
    }, 200)
    return () => clearTimeout(t)
  }, [activeRow, rows])

  return (
    <fieldset className="studio-fieldset">
      <legend className="studio-legend">Tracklist</legend>
      <p className="studio-text-muted-sm studio-m-0 studio-mb-md">
        Timestamps in seconds. Tag Tahti artists with <code>@handle</code> in the artist field.
      </p>
      {rows.map((row, i) => (
        <div key={i} className="studio-track-grid">
          <input
            type="number"
            min={0}
            placeholder="sec"
            value={row.startSec}
            disabled={disabled}
            onChange={(e) => {
              const next = [...rows]
              next[i] = { ...next[i], startSec: e.target.value }
              sync(next)
            }}
            className="studio-input"
          />
          <input
            type="text"
            placeholder="Track title"
            value={row.title}
            disabled={disabled}
            onChange={(e) => {
              const next = [...rows]
              next[i] = { ...next[i], title: e.target.value }
              sync(next)
            }}
            className="studio-input"
          />
          <div className="studio-relative">
            <input
              type="text"
              placeholder="Artist or @handle"
              value={row.artist}
              disabled={disabled}
              onFocus={() => setActiveRow(i)}
              onBlur={() => setTimeout(() => setActiveRow(null), 150)}
              onChange={(e) => {
                const next = [...rows]
                next[i] = { ...next[i], artist: e.target.value }
                sync(next)
              }}
              className="studio-input"
            />
            {activeRow === i && suggestions.length > 0 && (
              <ul className="studio-suggest-list">
                {suggestions.map((u) => (
                  <li key={u.username}>
                    <button
                      type="button"
                      className="studio-suggest-item"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        const next = [...rows]
                        next[i] = { ...next[i], artist: `@${u.username}` }
                        sync(next)
                        setSuggestions([])
                      }}
                    >
                      @{u.username} <span className="studio-text-muted-sm">{u.displayName}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            disabled={disabled || rows.length <= 1}
            onClick={() => sync(rows.filter((_, j) => j !== i))}
            aria-label="Remove row"
            className="ui-btn ui-btn--sm ui-btn--ghost"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => sync([...rows, { startSec: '0', title: '', artist: '' }])}
        className="ui-btn ui-btn--sm ui-btn--ghost studio-mt-sm"
      >
        + Add track
      </button>
    </fieldset>
  )
}
