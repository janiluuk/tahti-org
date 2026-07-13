// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import {
  createVenueQuick,
  fetchMyDefaultLocation,
  fetchVenuesForPicker,
  type VenuePickerOption,
} from './archive-actions'

export function VenuePicker({
  venueId,
  disabled,
  onChange,
}: {
  venueId: string | null
  disabled?: boolean
  onChange(venueId: string | null): void
}) {
  const [venues, setVenues] = useState<VenuePickerOption[]>([])
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    fetchVenuesForPicker().then(setVenues)
  }, [])

  const selected = venues.find((v) => v.id === venueId)
  const q = query.trim().toLowerCase()
  const filtered = q
    ? venues.filter((v) => `${v.name} ${v.city}`.toLowerCase().includes(q))
    : venues

  if (selected) {
    return (
      <div className="studio-field--block">
        <span className="studio-label">Venue</span>
        <div className="studio-row--between studio-mt-xs">
          <span className="studio-text-sm">
            {selected.name} · {selected.city}, {selected.countryCode}
          </span>
          {!disabled && (
            <button
              type="button"
              className="studio-link studio-text-sm"
              onClick={() => onChange(null)}
            >
              Change
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="studio-field--block">
      <span className="studio-label">Venue</span>
      <input
        type="text"
        className="studio-input studio-mt-xs"
        placeholder="Search venues by name or city…"
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
      />
      {q && (
        <ul className="studio-list studio-mt-xs">
          {filtered.slice(0, 8).map((v) => (
            <li key={v.id} className="studio-item-row--list">
              <button
                type="button"
                className="studio-link studio-text-sm"
                onClick={() => {
                  onChange(v.id)
                  setQuery('')
                }}
              >
                {v.name} · {v.city}, {v.countryCode}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="studio-text-muted-sm">No matches — add it below.</li>
          )}
        </ul>
      )}
      {!disabled && (
        <button
          type="button"
          className="studio-link studio-text-sm studio-mt-xs"
          onClick={() => setShowCreate((s) => !s)}
        >
          {showCreate ? 'Cancel' : "Can't find it? + Add a new venue"}
        </button>
      )}
      {showCreate && (
        <CreateVenueInline
          onCreated={(v) => {
            setVenues((prev) => [...prev, v])
            onChange(v.id)
            setShowCreate(false)
            setQuery('')
          }}
        />
      )}
    </div>
  )
}

function CreateVenueInline({ onCreated }: { onCreated(venue: VenuePickerOption): void }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [countryCode, setCountryCode] = useState('FI')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [photosText, setPhotosText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMyDefaultLocation().then((loc) => {
      if (!loc) return
      const [defaultCity, defaultCountry] = loc.split(',')
      if (defaultCity?.trim()) setCity((prev) => prev || defaultCity.trim())
      if (defaultCountry?.trim()) {
        setCountryCode((prev) =>
          prev === 'FI' ? defaultCountry.trim().slice(0, 2).toUpperCase() : prev,
        )
      }
    })
  }, [])

  async function submit() {
    if (!name.trim() || !address.trim() || !city.trim()) {
      setError('Name, address, and city are required.')
      return
    }
    setPending(true)
    setError(null)
    const photos = photosText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10)

    const result = await createVenueQuick({
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      countryCode: countryCode.trim() || undefined,
      latitude: latitude.trim() ? Number(latitude) : undefined,
      longitude: longitude.trim() ? Number(longitude) : undefined,
      photos: photos.length ? photos : undefined,
    })
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.venue) onCreated(result.venue)
  }

  return (
    <div className="studio-subsection studio-mt-sm">
      <input
        type="text"
        placeholder="Venue name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="studio-input studio-mb-xs"
      />
      <input
        type="text"
        placeholder="Street address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="studio-input studio-mb-xs"
      />
      <div className="studio-grid studio-grid--2">
        <input
          type="text"
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="studio-input"
        />
        <input
          type="text"
          placeholder="Country code (e.g. FI)"
          value={countryCode}
          maxLength={2}
          onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
          className="studio-input"
        />
      </div>
      <div className="studio-grid studio-grid--2 studio-mt-xs">
        <input
          type="text"
          inputMode="decimal"
          placeholder="Latitude (optional, for map)"
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
          className="studio-input"
        />
        <input
          type="text"
          inputMode="decimal"
          placeholder="Longitude (optional, for map)"
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
          className="studio-input"
        />
      </div>
      <textarea
        placeholder="Photo URLs, one per line (optional slideshow)"
        rows={2}
        value={photosText}
        onChange={(e) => setPhotosText(e.target.value)}
        className="studio-input studio-mt-xs"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="ui-btn ui-btn--primary ui-btn--sm studio-mt-xs"
      >
        {pending ? 'Creating…' : 'Create & use this venue'}
      </button>
      {error && <p className="studio-text-error studio-text-sm studio-mt-xs">{error}</p>}
      <p className="studio-text-muted-sm studio-mt-xs">
        New venues are pending board review before they appear in the public directory — you can use
        it here right away.
      </p>
    </div>
  )
}
