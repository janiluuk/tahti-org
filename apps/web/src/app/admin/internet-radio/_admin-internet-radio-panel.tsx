// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Badge, Button, Field, Input, Panel } from '@tahti/ui'
import type { InternetRadioPreset } from '@tahti/shared'
import {
  createInternetRadioPreset,
  deleteInternetRadioPreset,
  updateInternetRadioPreset,
} from './actions'

function PresetRow({
  preset,
  onChange,
  onRemove,
}: {
  preset: InternetRadioPreset
  onChange: (preset: InternetRadioPreset) => void
  onRemove: (id: string) => void
}) {
  const [streamUrl, setStreamUrl] = useState(preset.streamUrl ?? '')
  const [iconUrl, setIconUrl] = useState(preset.iconUrl ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setPending(true)
    setError(null)
    const result = await updateInternetRadioPreset(preset.id, {
      streamUrl: streamUrl.trim(),
      iconUrl: iconUrl.trim(),
    })
    setPending(false)
    if (result.error || !result.preset) {
      setError(result.error ?? 'Failed to save')
      return
    }
    onChange(result.preset)
  }

  return (
    <div className="ui-panel studio-mt-sm">
      <div className="admin-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>{preset.name}</strong>{' '}
          {preset.genre && <Badge variant="neutral">{preset.genre}</Badge>}
          {preset.description && <p className="admin-text-muted">{preset.description}</p>}
        </div>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() => onRemove(preset.id)}
        >
          Delete
        </Button>
      </div>
      <div className="admin-row studio-mt-sm" style={{ gap: '0.5rem' }}>
        <Input
          value={streamUrl}
          onChange={(e) => setStreamUrl(e.target.value)}
          placeholder="https://…/stream.m3u8"
          disabled={pending}
        />
        <Input
          value={iconUrl}
          onChange={(e) => setIconUrl(e.target.value)}
          placeholder="https://…/logo.png"
          disabled={pending}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => void handleSave()}
        >
          Save
        </Button>
      </div>
      {error && <p className="admin-form-error">{error}</p>}
    </div>
  )
}

export function AdminInternetRadioPanel({
  initialPresets,
}: {
  initialPresets: InternetRadioPreset[]
}) {
  const [presets, setPresets] = useState(initialPresets)
  const [name, setName] = useState('')
  const [genre, setGenre] = useState('')
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim()) return
    setPending(true)
    setError(null)
    const result = await createInternetRadioPreset({
      name: name.trim(),
      genre: genre.trim() || undefined,
      description: description.trim() || undefined,
    })
    setPending(false)
    if (result.error || !result.preset) {
      setError(result.error ?? 'Failed to create')
      return
    }
    setPresets((prev) => [...prev, result.preset!])
    setName('')
    setGenre('')
    setDescription('')
  }

  async function handleRemove(id: string) {
    setError(null)
    const result = await deleteInternetRadioPreset(id)
    if (result.error) {
      setError(result.error)
      return
    }
    setPresets((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div>
      <Panel title="Add a preset station">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="YleX" />
        </Field>
        <Field label="Genre">
          <Input
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="Pop / Hits"
          />
        </Field>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Button
          variant="primary"
          disabled={pending || !name.trim()}
          onClick={() => void handleCreate()}
        >
          {pending ? 'Adding…' : 'Add preset'}
        </Button>
        {error && <p className="admin-form-error">{error}</p>}
      </Panel>

      <h2 className="studio-mt-lg">Presets</h2>
      {presets.length === 0 ? (
        <p className="admin-text-muted">No presets yet.</p>
      ) : (
        presets.map((p) => (
          <PresetRow
            key={p.id}
            preset={p}
            onChange={(updated) =>
              setPresets((prev) => prev.map((pr) => (pr.id === updated.id ? updated : pr)))
            }
            onRemove={(id) => void handleRemove(id)}
          />
        ))
      )}
    </div>
  )
}
