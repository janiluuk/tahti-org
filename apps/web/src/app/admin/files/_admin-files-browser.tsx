// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react'
import Link from 'next/link'
import {
  SOUND_CONTENT_TYPES,
  SOUND_GENRES,
  type AdminFileRow,
  type AdminFilesFacetsResponse,
  type AdminFilesListResponse,
} from '@tahti/shared'
import { Alert } from '@tahti/ui'
import { usePlayer, type PlayerTrack } from '@/contexts/player-context'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
const PRESETS_KEY = 'tahti-admin-files-filter-presets'

interface FilterPreset {
  name: string
  q: string
  userIds: string[]
  genres: string[]
  contentTypes: string[]
}

function readPresets(): FilterPreset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PRESETS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p): p is FilterPreset =>
        !!p &&
        typeof p === 'object' &&
        typeof (p as FilterPreset).name === 'string' &&
        Array.isArray((p as FilterPreset).userIds) &&
        Array.isArray((p as FilterPreset).genres) &&
        Array.isArray((p as FilterPreset).contentTypes),
    )
  } catch {
    return []
  }
}

function writePresets(presets: FilterPreset[]) {
  window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
}

function fmtDuration(sec: number | null) {
  if (sec == null || sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function genreLabel(row: AdminFileRow) {
  return row.genreCustom || row.genre || '—'
}

function MultiFilter({
  label,
  options,
  selected,
  onChange,
  optionLabel,
}: {
  label: string
  options: string[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  optionLabel?: (id: string) => string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="admin-files-filter" ref={ref}>
      <button
        type="button"
        className={`admin-files-filter__btn${selected.size ? ' admin-files-filter__btn--active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {label}
        {selected.size > 0 ? ` (${selected.size})` : ''}
      </button>
      {open && (
        <div className="admin-files-filter__menu" role="listbox" aria-multiselectable>
          {options.length === 0 ? (
            <p className="admin-files-filter__empty">No options</p>
          ) : (
            options.map((id) => {
              const checked = selected.has(id)
              return (
                <label key={id} className="admin-files-filter__option">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = new Set(selected)
                      if (checked) next.delete(id)
                      else next.add(id)
                      onChange(next)
                    }}
                  />
                  <span>{optionLabel ? optionLabel(id) : id}</span>
                </label>
              )
            })
          )}
          {selected.size > 0 && (
            <button
              type="button"
              className="admin-files-filter__clear"
              onClick={() => onChange(new Set())}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function FileRow({
  row,
  selected,
  onToggle,
  onEdit,
  onDeleted,
}: {
  row: AdminFileRow
  selected: boolean
  onToggle: () => void
  onEdit: () => void
  onDeleted: () => void
}) {
  const { track, playing, currentTime, duration, load, togglePlay, seek } = usePlayer()
  const isCurrent = track?.id === row.id
  const progress = isCurrent && duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function playPreview(e: MouseEvent) {
    e.stopPropagation()
    if (isCurrent) {
      void togglePlay()
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/files/${row.id}/audio`, {
        credentials: 'include',
      })
      if (!res.ok) return
      const data = (await res.json()) as {
        audioUrl: string | null
        title: string
        artistName: string
        channelSlug: string
        bannerUrl: string | null
      }
      if (!data.audioUrl) return

      const playerTrack: PlayerTrack = {
        id: row.id,
        kind: 'sound',
        url: data.audioUrl,
        title: data.title,
        subtitle: data.artistName,
        href: `/admin/channels/${data.channelSlug}/archive`,
        artworkUrl: data.bannerUrl,
      }
      load(playerTrack, { autoplay: true, queue: [playerTrack] })
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(e: MouseEvent) {
    e.stopPropagation()
    if (!window.confirm(`Delete “${row.title}”? This cannot be undone.`)) return
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/files/${row.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok || res.status === 204) onDeleted()
      else {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'Delete failed')
      }
    } finally {
      setBusy(false)
    }
  }

  function handleRowSeek(e: MouseEvent<HTMLDivElement>) {
    if (!isCurrent || duration <= 0) return
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, label')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    seek(ratio)
  }

  return (
    <div
      className={`admin-files-row${isCurrent ? ' admin-files-row--active' : ''}${
        playing && isCurrent ? ' admin-files-row--playing' : ''
      }`}
      style={
        isCurrent
          ? ({ '--admin-files-progress': `${progress * 100}%` } as CSSProperties)
          : undefined
      }
      onClick={handleRowSeek}
      role={isCurrent ? 'slider' : undefined}
      aria-valuemin={isCurrent ? 0 : undefined}
      aria-valuemax={isCurrent ? 100 : undefined}
      aria-valuenow={isCurrent ? Math.round(progress * 100) : undefined}
      aria-label={isCurrent ? `Seek ${row.title}` : undefined}
    >
      {error && <Alert variant="error">{error}</Alert>}
      <label className="admin-files-row__check" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label="Select file" />
      </label>
      <div className="admin-files-row__main">
        <span className="admin-files-row__title">{row.title}</span>
        <span className="admin-files-row__meta">
          {row.artistName}
          <span aria-hidden> · </span>@{row.username}
          <span aria-hidden> · </span>
          {genreLabel(row)}
          <span aria-hidden> · </span>
          {row.contentType.replace(/_/g, ' ')}
          <span aria-hidden> · </span>
          {fmtDuration(row.durationSec)}
          {!row.isPublic && <span className="admin-files-row__badge">private</span>}
          {row.status !== 'READY' && <span className="admin-files-row__badge">{row.status}</span>}
        </span>
      </div>
      <div className="admin-files-row__actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="ui-btn ui-btn--sm ui-btn--ghost"
          onClick={playPreview}
          disabled={busy}
          aria-label={isCurrent && playing ? 'Pause' : 'Preview'}
        >
          {isCurrent && playing ? 'Pause' : 'Preview'}
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--sm ui-btn--ghost"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          Edit
        </button>
        <Link
          href={`/admin/channels/${row.channelSlug}/archive`}
          className="ui-btn ui-btn--sm ui-btn--ghost"
        >
          Channel
        </Link>
        <button
          type="button"
          className="ui-btn ui-btn--sm ui-btn--ghost admin-files-row__danger"
          onClick={handleDelete}
          disabled={busy}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

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

  async function saveEdit(payload: {
    title: string
    genre: string
    contentType: string
    isPublic: boolean
  }) {
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

function EditModal({
  row,
  genreOptions,
  onClose,
  onSave,
}: {
  row: AdminFileRow
  genreOptions: string[]
  onClose: () => void
  onSave: (payload: {
    title: string
    genre: string
    contentType: string
    isPublic: boolean
  }) => void
}) {
  const [title, setTitle] = useState(row.title)
  const [genre, setGenre] = useState(row.genreCustom || row.genre || '')
  const [contentType, setContentType] = useState(row.contentType)
  const [isPublic, setIsPublic] = useState(row.isPublic)

  return (
    <div className="admin-files-modal" role="dialog" aria-modal aria-label="Edit file">
      <div className="admin-files-modal__card">
        <h2 className="admin-files-modal__title">Edit file</h2>
        <label className="admin-files-modal__field">
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="admin-files-modal__field">
          Genre
          <input
            list="admin-files-genres"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
          />
          <datalist id="admin-files-genres">
            {genreOptions.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
        <label className="admin-files-modal__field">
          Type
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value as (typeof SOUND_CONTENT_TYPES)[number])}
          >
            {SOUND_CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-files-modal__check">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          Public
        </label>
        <div className="admin-files-modal__actions">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--primary"
            onClick={() => onSave({ title, genre, contentType, isPublic })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
