'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  SOUND_CONTENT_TYPES,
  SOUND_GENRES,
  type AdminFileRow,
  type AdminFilesFacetsResponse,
  type AdminFilesListResponse,
} from '@tahti/shared'
import { Alert } from '@tahti/ui'
import { EditModal } from './_admin-files-edit-modal'
import { MultiFilter, readPresets, writePresets } from './_admin-files-filters'
import { FileRow } from './_admin-files-row'
import { API_BASE, type EditFilePayload, type FilterPreset } from './_admin-files-types'

export function AdminFilesBrowser() {
  const [facets, setFacets] = useState<AdminFilesFacetsResponse | null>(null)
  const [items, setItems] = useState<AdminFileRow[]>([])
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [userIds, setUserIds] = useState<Set<string>>(new Set())
  const [genres, setGenres] = useState<Set<string>>(new Set())
  const [types, setTypes] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkGenre, setBulkGenre] = useState('')
  const [bulkType, setBulkType] = useState('')
  const [bulkPublic, setBulkPublic] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [presets, setPresets] = useState<FilterPreset[]>([])
  const [activePreset, setActivePreset] = useState('')
  const [presetNameDraft, setPresetNameDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPresets(readPresets())
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 250)
    return () => window.clearTimeout(t)
  }, [q])

  useEffect(() => {
    void fetch(`${API_BASE}/api/admin/files/facets`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: AdminFilesFacetsResponse | null) => {
        if (data) setFacets(data)
      })
  }, [])

  const load = useCallback(
    async (cursor?: string | null, append = false) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (userIds.size) params.set('userIds', [...userIds].join(','))
        if (genres.size) params.set('genres', [...genres].join(','))
        if (types.size) params.set('contentTypes', [...types].join(','))
        if (qDebounced) params.set('q', qDebounced)
        if (cursor) params.set('cursor', cursor)
        params.set('limit', '50')
        const res = await fetch(`${API_BASE}/api/admin/files?${params}`, {
          credentials: 'include',
        })
        if (!res.ok) return
        const data = (await res.json()) as AdminFilesListResponse
        setTotal(data.total)
        setNextCursor(data.nextCursor)
        setItems((prev) => (append ? [...prev, ...data.items] : data.items))
        if (!append) setSelected(new Set())
      } finally {
        setLoading(false)
      }
    },
    [userIds, genres, types, qDebounced],
  )

  useEffect(() => {
    void load(null, false)
  }, [load])

  const userLabel = useMemo(() => {
    const map = new Map(facets?.users.map((u) => [u.id, `${u.displayName} (@${u.username})`]))
    return (id: string) => map.get(id) ?? id
  }, [facets])

  const genreOptions = useMemo(() => {
    const set = new Set<string>([...SOUND_GENRES, ...(facets?.genres ?? [])])
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [facets])

  const editRow = items.find((i) => i.id === editId) ?? null

  async function applyBulk() {
    if (selected.size === 0) return
    const body: Record<string, unknown> = { ids: [...selected] }
    if (bulkGenre) {
      if ((SOUND_GENRES as readonly string[]).includes(bulkGenre)) {
        body.genre = bulkGenre
        body.genreCustom = null
      } else {
        body.genre = 'Other'
        body.genreCustom = bulkGenre
      }
    }
    if (bulkType) body.contentType = bulkType
    if (bulkPublic === 'public') body.isPublic = true
    if (bulkPublic === 'private') body.isPublic = false
    if (!bulkGenre && !bulkType && !bulkPublic) {
      setError('Pick a genre, type, or visibility to assign.')
      return
    }
    setBulkBusy(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/files/bulk`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setError(err.error ?? 'Bulk update failed')
        return
      }
      setBulkGenre('')
      setBulkType('')
      setBulkPublic('')
      await load(null, false)
    } finally {
      setBulkBusy(false)
    }
  }

  async function saveEdit(payload: EditFilePayload) {
    if (!editId) return
    const body: Record<string, unknown> = {
      title: payload.title,
      contentType: payload.contentType,
      isPublic: payload.isPublic,
    }
    if ((SOUND_GENRES as readonly string[]).includes(payload.genre)) {
      body.genre = payload.genre
      body.genreCustom = null
    } else if (payload.genre) {
      body.genre = 'Other'
      body.genreCustom = payload.genre
    } else {
      body.genre = null
      body.genreCustom = null
    }
    const res = await fetch(`${API_BASE}/api/admin/files/${editId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string }
      setError(err.error ?? 'Save failed')
      return
    }
    setEditId(null)
    await load(null, false)
  }

  const allVisibleSelected = items.length > 0 && items.every((i) => selected.has(i.id))

  function applyPreset(preset: FilterPreset) {
    setQ(preset.q ?? '')
    setQDebounced((preset.q ?? '').trim())
    setUserIds(new Set(preset.userIds))
    setGenres(new Set(preset.genres))
    setTypes(new Set(preset.contentTypes))
    setActivePreset(preset.name)
    setPresetNameDraft(preset.name)
  }

  function clearFilters() {
    setQ('')
    setQDebounced('')
    setUserIds(new Set())
    setGenres(new Set())
    setTypes(new Set())
    setActivePreset('')
    setPresetNameDraft('')
  }

  function saveCurrentAsPreset() {
    const name = presetNameDraft.trim()
    if (!name) {
      setError('Enter a preset name.')
      return
    }
    const existing = presets.find((p) => p.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      const ok = window.confirm(
        `A preset named “${existing.name}” already exists. Overwrite it with the current filters?`,
      )
      if (!ok) return
    }

    const nextPreset: FilterPreset = {
      name: existing?.name ?? name,
      q: q.trim(),
      userIds: [...userIds],
      genres: [...genres],
      contentTypes: [...types],
    }
    const next = [
      nextPreset,
      ...presets.filter((p) => p.name.toLowerCase() !== name.toLowerCase()),
    ].sort((a, b) => a.name.localeCompare(b.name))
    writePresets(next)
    setPresets(next)
    setActivePreset(nextPreset.name)
    setPresetNameDraft(nextPreset.name)
  }

  function deleteActivePreset() {
    if (!activePreset) return
    const ok = window.confirm(`Delete preset “${activePreset}”?`)
    if (!ok) return
    const next = presets.filter((p) => p.name !== activePreset)
    writePresets(next)
    setPresets(next)
    setActivePreset('')
  }

  const hasActiveFilters =
    q.trim().length > 0 || userIds.size > 0 || genres.size > 0 || types.size > 0

  return (
    <div className="admin-files">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="admin-files-search-row">
        <label className="admin-files-search-label" htmlFor="admin-files-search">
          Search
        </label>
        <input
          id="admin-files-search"
          type="search"
          className="admin-files-search"
          placeholder="Further filter by title, artist name, or @username…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setActivePreset('')
          }}
          autoComplete="off"
        />
        {q && (
          <button
            type="button"
            className="ui-btn ui-btn--sm ui-btn--ghost"
            onClick={() => {
              setQ('')
              setActivePreset('')
            }}
          >
            Clear search
          </button>
        )}
      </div>

      <div className="admin-files-toolbar">
        <MultiFilter
          label="Users"
          options={(facets?.users ?? []).map((u) => u.id)}
          selected={userIds}
          onChange={(next) => {
            setUserIds(next)
            setActivePreset('')
          }}
          optionLabel={userLabel}
        />
        <MultiFilter
          label="Genres"
          options={genreOptions}
          selected={genres}
          onChange={(next) => {
            setGenres(next)
            setActivePreset('')
          }}
        />
        <MultiFilter
          label="Types"
          options={[...(facets?.contentTypes ?? SOUND_CONTENT_TYPES)]}
          selected={types}
          onChange={(next) => {
            setTypes(next)
            setActivePreset('')
          }}
          optionLabel={(t) => t.replace(/_/g, ' ')}
        />
        {hasActiveFilters && (
          <button type="button" className="ui-btn ui-btn--sm ui-btn--ghost" onClick={clearFilters}>
            Clear filters
          </button>
        )}
        <span className="admin-files-count">
          {loading ? 'Loading…' : `${total} file${total === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className="admin-files-presets">
        <span className="admin-files-presets__label">Presets</span>
        <select
          className="admin-files-presets__select"
          value={activePreset}
          aria-label="Load filter preset"
          onChange={(e) => {
            const name = e.target.value
            if (!name) {
              setActivePreset('')
              return
            }
            const preset = presets.find((p) => p.name === name)
            if (preset) applyPreset(preset)
          }}
        >
          <option value="">Load preset…</option>
          {presets.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          className="admin-files-presets__name"
          placeholder="Preset name"
          value={presetNameDraft}
          onChange={(e) => setPresetNameDraft(e.target.value)}
          maxLength={60}
          aria-label="Preset name"
        />
        <button
          type="button"
          className="ui-btn ui-btn--sm ui-btn--secondary"
          onClick={saveCurrentAsPreset}
          disabled={!presetNameDraft.trim()}
          title="Save the current search and filters as a named preset"
        >
          Save preset
        </button>
        {activePreset && (
          <button
            type="button"
            className="ui-btn ui-btn--sm ui-btn--ghost admin-files-row__danger"
            onClick={deleteActivePreset}
          >
            Delete preset
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="admin-files-bulk">
          <span className="admin-files-bulk__label">{selected.size} selected</span>
          <select
            value={bulkGenre}
            onChange={(e) => setBulkGenre(e.target.value)}
            aria-label="Assign genre"
          >
            <option value="">Genre…</option>
            {genreOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            value={bulkType}
            onChange={(e) => setBulkType(e.target.value)}
            aria-label="Assign type"
          >
            <option value="">Type…</option>
            {SOUND_CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select
            value={bulkPublic}
            onChange={(e) => setBulkPublic(e.target.value)}
            aria-label="Assign visibility"
          >
            <option value="">Visibility…</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
          <button
            type="button"
            className="ui-btn ui-btn--sm ui-btn--primary"
            disabled={bulkBusy}
            onClick={() => void applyBulk()}
          >
            Apply
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--sm ui-btn--ghost"
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="admin-files-list-head">
        <label className="admin-files-row__check">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={() => {
              if (allVisibleSelected) setSelected(new Set())
              else setSelected(new Set(items.map((i) => i.id)))
            }}
            aria-label="Select all visible"
          />
        </label>
        <span>Track</span>
        <span className="admin-files-list-head__actions">Actions</span>
      </div>

      <div className="admin-files-list" role="list">
        {items.map((row) => (
          <FileRow
            key={row.id}
            row={row}
            selected={selected.has(row.id)}
            onToggle={() => {
              setSelected((prev) => {
                const next = new Set(prev)
                if (next.has(row.id)) next.delete(row.id)
                else next.add(row.id)
                return next
              })
            }}
            onEdit={() => setEditId(row.id)}
            onDeleted={() => {
              setItems((prev) => prev.filter((i) => i.id !== row.id))
              setSelected((prev) => {
                const next = new Set(prev)
                next.delete(row.id)
                return next
              })
              setTotal((t) => Math.max(0, t - 1))
            }}
          />
        ))}
        {!loading && items.length === 0 && (
          <p className="admin-files-empty">No files match these filters.</p>
        )}
      </div>

      {nextCursor && (
        <button
          type="button"
          className="ui-btn ui-btn--secondary admin-files-more"
          disabled={loading}
          onClick={() => void load(nextCursor, true)}
        >
          Load more
        </button>
      )}

      {editRow && (
        <EditModal
          row={editRow}
          genreOptions={genreOptions}
          onClose={() => setEditId(null)}
          onSave={(payload) => void saveEdit(payload)}
        />
      )}
    </div>
  )
}
