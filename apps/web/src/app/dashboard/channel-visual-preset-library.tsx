// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import type { ChannelVisualPresetDto } from '@tahti/shared'
import { ButtonIcon, Button } from '@tahti/ui'
import {
  deleteChannelVisualPreset,
  listChannelVisualPresets,
  saveChannelVisualPreset,
} from './channel-visual-presets-actions'
import type { ChannelVisualDraft } from './channel-visual-preset-panel'

type Props = {
  /** The designer's current unsaved visual draft — what "Save preset" snapshots. */
  current: ChannelVisualDraft
  /** Applies a saved preset's settings onto the designer's draft (still needs Save to persist live). */
  onApply: (settings: ChannelVisualDraft) => void
}

/** "Looks" — named snapshots of the whole Visual style section a channel owner can save,
 * re-apply, and delete. Backed by GET/POST/DELETE /api/me/channel/visual-presets
 * (`ChannelVisualPreset`, unique per channel+name — saving under an existing name overwrites it). */
export function ChannelVisualPresetLibrary({ current, onApply }: Props) {
  const [presets, setPresets] = useState<ChannelVisualPresetDto[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [confirmOverwriteId, setConfirmOverwriteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function refresh() {
    setLoading(true)
    const res = await listChannelVisualPresets()
    setLoading(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setPresets(res.presets)
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    if (!saveOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSaveModal()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveOpen])

  function closeSaveModal() {
    setSaveOpen(false)
    setSaveName('')
    setConfirmOverwriteId(null)
  }

  function applyPreset(id: string) {
    setSelectedId(id)
    setError(null)
    setMessage(null)
    if (!id) return
    const preset = presets.find((p) => p.id === id)
    if (!preset) return
    onApply(preset.settings as unknown as ChannelVisualDraft)
    setMessage(`Applied "${preset.name}". Click Save below to publish it live.`)
  }

  function openSaveModal() {
    setError(null)
    setMessage(null)
    setSaveName('')
    setConfirmOverwriteId(null)
    setSaveOpen(true)
  }

  function handleSaveSubmit() {
    const name = saveName.trim()
    if (!name) {
      setError('Enter a name for this Look.')
      return
    }
    const existing = presets.find((p) => p.name.toLowerCase() === name.toLowerCase())
    if (existing && confirmOverwriteId !== existing.id) {
      // First submit on a colliding name asks for confirmation instead of saving.
      setConfirmOverwriteId(existing.id)
      return
    }
    setSaving(true)
    setError(null)
    void saveChannelVisualPreset(name, current).then((res) => {
      setSaving(false)
      if (res.error || !res.preset) {
        setError(res.error ?? 'Failed to save Look')
        return
      }
      closeSaveModal()
      setMessage(`Saved "${res.preset.name}".`)
      setSelectedId(res.preset.id)
      void refresh()
    })
  }

  function handleDelete() {
    const preset = presets.find((p) => p.id === selectedId)
    if (!preset) return
    if (!window.confirm(`Delete the saved Look "${preset.name}"? This can't be undone.`)) return
    setDeleting(true)
    setError(null)
    void deleteChannelVisualPreset(preset.id).then((res) => {
      setDeleting(false)
      if (res.error) {
        setError(res.error)
        return
      }
      setMessage(`Deleted "${preset.name}".`)
      setSelectedId('')
      void refresh()
    })
  }

  return (
    <div className="studio-field--block channel-visual-preset-library">
      <span className="studio-label">Saved Looks</span>

      <div className="studio-row studio-row--wrap">
        <select
          className="studio-input studio-input--grow"
          value={selectedId}
          disabled={loading}
          onChange={(e) => applyPreset(e.target.value)}
          aria-label="Saved Looks"
        >
          <option value="">{loading ? 'Loading…' : 'Choose a saved Look…'}</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button variant="secondary" size="sm" onClick={openSaveModal}>
          <ButtonIcon name="save" />
          Save preset
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!selectedId || deleting}
          onClick={handleDelete}
        >
          <ButtonIcon name="trash" />
          {deleting ? 'Deleting…' : 'Delete'}
        </Button>
      </div>

      {error && <p className="studio-notice studio-notice--error">{error}</p>}
      {message && <p className="studio-notice studio-notice--success">{message}</p>}

      {saveOpen ? (
        <div
          className="spotify-import-modal__overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSaveModal()
          }}
        >
          <div
            className="spotify-import-modal channel-visual-preset-save-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Save Look"
          >
            <div className="spotify-import-modal__header">
              <h2 className="spotify-import-modal__title">Save Look</h2>
              <button
                type="button"
                className="spotify-import-modal__close"
                onClick={closeSaveModal}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {confirmOverwriteId ? (
              <>
                <p className="studio-notice studio-notice--error">
                  A Look named &ldquo;{saveName.trim()}&rdquo; already exists. Saving will overwrite
                  it with the current settings.
                </p>
                <div className="studio-row studio-mt-sm">
                  <Button variant="secondary" size="sm" onClick={() => setConfirmOverwriteId(null)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" disabled={saving} onClick={handleSaveSubmit}>
                    {saving ? 'Overwriting…' : 'Overwrite'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <label className="studio-field" htmlFor="channel-visual-preset-name">
                  <span className="studio-label">Name</span>
                  <input
                    id="channel-visual-preset-name"
                    type="text"
                    className="studio-input"
                    placeholder="e.g. Late-night set"
                    maxLength={60}
                    value={saveName}
                    autoFocus
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveSubmit()
                    }}
                  />
                </label>
                {error && <p className="studio-notice studio-notice--error">{error}</p>}
                <div className="studio-row studio-mt-sm">
                  <Button variant="secondary" size="sm" onClick={closeSaveModal}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" disabled={saving} onClick={handleSaveSubmit}>
                    <ButtonIcon name="save" />
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
