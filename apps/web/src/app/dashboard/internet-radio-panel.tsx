// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Badge, Button, Input, Panel } from '@tahti/ui'
import type { InternetRadioPreset, InternetRadioStation } from '@tahti/shared'
import { usePlayer } from '@/contexts/player-context'
import {
  addCustomInternetRadioStation,
  addInternetRadioStationFromPreset,
  patchInternetRadioStation,
  removeInternetRadioStation,
} from './internet-radio-actions'

export interface InternetRadioPanelProps {
  initialPresets: InternetRadioPreset[]
  initialStations: InternetRadioStation[]
}

function StationRow({
  station,
  onUpdate,
  onRemove,
}: {
  station: InternetRadioStation
  onUpdate: (station: InternetRadioStation) => void
  onRemove: (id: string) => void
}) {
  const { track, playing, load, togglePlay } = usePlayer()
  const [urlDraft, setUrlDraft] = useState(station.streamUrl ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isCurrent = station.streamUrl != null && track?.id === station.streamUrl

  async function handlePlay() {
    if (!station.streamUrl) return
    if (isCurrent) {
      await togglePlay()
      return
    }
    load(
      {
        id: station.streamUrl,
        kind: 'live',
        url: station.streamUrl,
        title: station.name,
        subtitle: station.genre ?? undefined,
        artworkUrl: station.iconUrl,
      },
      { autoplay: true },
    )
  }

  async function handleSaveUrl() {
    setPending(true)
    setError(null)
    const result = await patchInternetRadioStation(station.id, { streamUrl: urlDraft.trim() })
    setPending(false)
    if (result.error || !result.station) {
      setError(result.error ?? 'Failed to save')
      return
    }
    onUpdate(result.station)
  }

  return (
    <div className="ui-panel">
      <div className="studio-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>{station.name}</strong>{' '}
          {station.genre && <Badge variant="neutral">{station.genre}</Badge>}
          {station.description && <p className="studio-text-muted-sm">{station.description}</p>}
        </div>
        <Button
          type="button"
          variant={isCurrent && playing ? 'secondary' : 'primary'}
          size="sm"
          disabled={!station.streamUrl}
          onClick={() => void handlePlay()}
        >
          {isCurrent && playing ? '❚❚ Pause' : '▶ Play'}
        </Button>
      </div>

      <div className="studio-row studio-mt-sm" style={{ gap: '0.5rem' }}>
        <Input
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          placeholder="https://…/stream.m3u8"
          disabled={pending}
        />
        <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => void handleSaveUrl()}>
          Save URL
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() => onRemove(station.id)}
        >
          Remove
        </Button>
      </div>
      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
    </div>
  )
}

export function InternetRadioPanel({ initialPresets, initialStations }: InternetRadioPanelProps) {
  const [stations, setStations] = useState(initialStations)
  const [error, setError] = useState<string | null>(null)
  const [addingPresetId, setAddingPresetId] = useState<string | null>(null)
  const [customName, setCustomName] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [addingCustom, setAddingCustom] = useState(false)

  const addedPresetIds = new Set(stations.map((s) => s.presetId).filter(Boolean))

  async function handleAddPreset(presetId: string) {
    setError(null)
    setAddingPresetId(presetId)
    const result = await addInternetRadioStationFromPreset(presetId)
    setAddingPresetId(null)
    if (result.error || !result.station) {
      setError(result.error ?? 'Failed to add')
      return
    }
    setStations((prev) => [...prev, result.station!])
  }

  async function handleAddCustom() {
    if (!customName.trim()) return
    setError(null)
    setAddingCustom(true)
    const result = await addCustomInternetRadioStation({
      name: customName.trim(),
      streamUrl: customUrl.trim() || undefined,
    })
    setAddingCustom(false)
    if (result.error || !result.station) {
      setError(result.error ?? 'Failed to add')
      return
    }
    setStations((prev) => [...prev, result.station!])
    setCustomName('')
    setCustomUrl('')
  }

  async function handleRemove(id: string) {
    setError(null)
    const result = await removeInternetRadioStation(id)
    if (result.error) {
      setError(result.error)
      return
    }
    setStations((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <Panel
      title="Internet radio"
      description="Add internet radio stations to your own library — played straight from the stream in your browser."
    >
      {stations.length === 0 ? (
        <p className="studio-empty">Nothing in your library yet — add a station below.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {stations.map((s) => (
            <StationRow
              key={s.id}
              station={s}
              onUpdate={(updated) =>
                setStations((prev) => prev.map((st) => (st.id === updated.id ? updated : st)))
              }
              onRemove={(id) => void handleRemove(id)}
            />
          ))}
        </div>
      )}

      {initialPresets.length > 0 && (
        <>
          <h3 className="studio-mt-lg">Presets</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {initialPresets.map((preset) => {
              const alreadyAdded = addedPresetIds.has(preset.id)
              return (
                <div key={preset.id} className="ui-panel studio-row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <strong>{preset.name}</strong>{' '}
                    {preset.genre && <Badge variant="neutral">{preset.genre}</Badge>}
                    {preset.description && <p className="studio-text-muted-sm">{preset.description}</p>}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={alreadyAdded || addingPresetId === preset.id}
                    onClick={() => void handleAddPreset(preset.id)}
                  >
                    {alreadyAdded ? 'Added' : addingPresetId === preset.id ? 'Adding…' : 'Add'}
                  </Button>
                </div>
              )
            })}
          </div>
        </>
      )}

      <h3 className="studio-mt-lg">Add a custom station</h3>
      <div className="studio-row" style={{ gap: '0.5rem' }}>
        <Input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Station name"
          disabled={addingCustom}
        />
        <Input
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          placeholder="https://…/stream.m3u8 (optional for now)"
          disabled={addingCustom}
        />
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={addingCustom || !customName.trim()}
          onClick={() => void handleAddCustom()}
        >
          Add
        </Button>
      </div>

      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
    </Panel>
  )
}
