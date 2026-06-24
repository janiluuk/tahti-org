// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createCollection } from '../../collection-actions'

const STYLE_OPTIONS = [
  { value: 'PLAYLIST', label: 'Playlist' },
  { value: 'ALBUM', label: 'Album' },
  { value: 'EP', label: 'EP' },
  { value: 'SINGLE', label: 'Single' },
  { value: 'DJ_SET_SERIES', label: 'DJ-set series' },
  { value: 'LIVE_ARCHIVE', label: 'Live archive' },
  { value: 'COMPILATION', label: 'Compilation' },
  { value: 'MIX_SERIES', label: 'Mix series' },
] as const

const VISIBILITY_OPTIONS = [
  { value: 'true', label: 'Public', desc: 'Visible on your profile' },
  { value: 'false', label: 'Draft', desc: 'Only you can see it' },
] as const

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export function NewCollectionForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [style, setStyle] = useState('PLAYLIST')
  const [isPublic, setIsPublic] = useState(true)
  const [description, setDescription] = useState('')
  const [slugOverride, setSlugOverride] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const derivedSlug = slugEdited ? slugOverride : slugify(name)

  const handleNameChange = useCallback(
    (v: string) => {
      setName(v)
      if (!slugEdited) setSlugOverride(slugify(v))
    },
    [slugEdited],
  )

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    setError(null)
    const { error: err } = await createCollection({
      name: name.trim(),
      slug: derivedSlug || undefined,
      type: 'CUSTOM',
      description: description.trim() || undefined,
      isPublic,
    })
    if (err) {
      setError(err)
      setSaving(false)
      return
    }
    router.push(`/dashboard/collections/${derivedSlug || slugify(name)}`)
  }, [name, derivedSlug, description, isPublic, router])

  return (
    <div className="collection-form">
      <div className="studio-field">
        <label className="studio-label" htmlFor="collection-name">
          Name
        </label>
        <input
          id="collection-name"
          className="studio-input"
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. Summer Mixes 2026"
          maxLength={100}
          autoFocus
        />
      </div>

      <div className="studio-field">
        <span className="studio-label">Style</span>
        <div className="collection-form__style-grid">
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`collection-form__style-pill${
                style === s.value ? ' collection-form__style-pill--active' : ''
              }`}
              onClick={() => setStyle(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <fieldset className="collection-form__vis-fieldset">
        <legend className="studio-label">Visibility</legend>
        <div className="collection-form__vis-row">
          {VISIBILITY_OPTIONS.map((v) => (
            <label key={v.value} className="collection-form__vis-option">
              <input
                type="radio"
                name="visibility"
                value={v.value}
                checked={(v.value === 'true') === isPublic}
                onChange={() => setIsPublic(v.value === 'true')}
              />
              <span className="collection-form__vis-copy">
                <span className="collection-form__vis-label">{v.label}</span>
                <span className="collection-form__vis-desc">{v.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="studio-field">
        <label className="studio-label" htmlFor="collection-description">
          Description
        </label>
        <textarea
          id="collection-description"
          className="studio-input collection-form__textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional — shown on your collection page"
          maxLength={1000}
          rows={2}
        />
      </div>

      <div className="studio-field">
        <label className="studio-label" htmlFor="collection-slug">
          URL slug
        </label>
        <div className="collection-form__slug-row">
          <span className="collection-form__slug-prefix">tahti.live/u/…/c/</span>
          <input
            id="collection-slug"
            className="studio-input collection-form__slug-input"
            type="text"
            value={derivedSlug}
            onChange={(e) => {
              setSlugEdited(true)
              setSlugOverride(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
            }}
            maxLength={64}
            spellCheck={false}
          />
        </div>
      </div>

      {error && <p className="studio-text-error studio-text-sm">{error}</p>}

      <div className="collection-form__actions">
        <button
          type="button"
          className="ui-btn ui-btn--ghost"
          onClick={() => router.back()}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--primary"
          onClick={() => void handleSubmit()}
          disabled={saving || !name.trim()}
        >
          {saving ? 'Creating…' : 'Create collection'}
        </button>
      </div>
    </div>
  )
}
