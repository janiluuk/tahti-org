'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useRef, useState } from 'react'
import { PRESETS_KEY, type FilterPreset } from './_admin-files-types'

export function readPresets(): FilterPreset[] {
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

export function writePresets(presets: FilterPreset[]) {
  window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
}

export function MultiFilter({
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
