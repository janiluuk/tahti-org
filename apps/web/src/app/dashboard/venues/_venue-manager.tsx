// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Panel, StudioCollapse } from '@tahti/ui'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

interface VenueBroadcast {
  id: string
  startAt: string
  endAt: string | null
  description: string | null
  channelId: string | null
  state: 'SCHEDULED' | 'LIVE' | 'CANCELED'
}

interface Venue {
  id: string
  slug: string
  name: string
  city: string
  countryCode: string
  capacity: number | null
  description: string | null
  address: string
  verifiedAt: string | null
  broadcasts: VenueBroadcast[]
}

interface Props {
  initialVenues: Venue[]
}

export function VenueManager({ initialVenues }: Props) {
  const [venues, setVenues] = useState(initialVenues)

  function updateVenue(updated: Venue) {
    setVenues((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
  }

  return (
    <div className="venue-manager">
      {venues.map((venue) => (
        <VenueCard key={venue.id} venue={venue} onUpdate={updateVenue} />
      ))}
    </div>
  )
}

function VenueCard({ venue, onUpdate }: { venue: Venue; onUpdate: (v: Venue) => void }) {
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [description, setDescription] = useState(venue.description ?? '')

  async function saveDescription() {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch(`${API_BASE}/api/v1/venues/${venue.slug}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() || null }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setMsg(err.error ?? 'Save failed')
      } else {
        const updated = (await res.json()) as Venue
        onUpdate({ ...updated, broadcasts: venue.broadcasts })
        setMsg('Saved.')
      }
    } catch {
      setMsg('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel
      title={venue.name}
      description={
        venue.verifiedAt ? `Verified · ${venue.city}` : `Pending verification · ${venue.city}`
      }
    >
      <div className="venue-card__meta studio-text-muted-sm studio-mb-sm">
        <span>
          <a
            href={`/venues/${venue.slug}`}
            target="_blank"
            rel="noreferrer"
            className="studio-link"
          >
            {venue.slug}.tahti.live/venues/…
          </a>
        </span>
        {venue.capacity && <span> · Capacity {venue.capacity}</span>}
        {!venue.verifiedAt && (
          <span className="venue-badge venue-badge--pending"> · Pending board review</span>
        )}
      </div>

      <label className="studio-field--block studio-mb-sm">
        <span className="studio-label">Description</span>
        <textarea
          className="studio-input studio-mt-xs"
          rows={3}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="studio-btn-primary studio-btn-sm"
        onClick={saveDescription}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Save description'}
      </button>
      {msg && (
        <span
          className={`studio-text-sm studio-ml-sm ${msg === 'Saved.' ? 'studio-text-success' : 'studio-text-error'}`}
        >
          {msg}
        </span>
      )}

      <StudioCollapse
        title="Upcoming broadcasts"
        hint={
          venue.broadcasts.length === 0 ? 'none scheduled' : `${venue.broadcasts.length} scheduled`
        }
      >
        <BroadcastList venue={venue} onVenueUpdate={onUpdate} />
        <AddBroadcastForm venue={venue} onVenueUpdate={onUpdate} />
      </StudioCollapse>
    </Panel>
  )
}

function BroadcastList({
  venue,
  onVenueUpdate,
}: {
  venue: Venue
  onVenueUpdate: (v: Venue) => void
}) {
  async function cancel(broadcastId: string) {
    const res = await fetch(`${API_BASE}/api/v1/venues/${venue.slug}/broadcasts/${broadcastId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (res.ok || res.status === 204) {
      onVenueUpdate({
        ...venue,
        broadcasts: venue.broadcasts.filter((b) => b.id !== broadcastId),
      })
    }
  }

  if (venue.broadcasts.length === 0) {
    return <p className="studio-text-muted-sm studio-mb-sm">No upcoming broadcasts.</p>
  }

  return (
    <ul className="studio-list studio-mb-md">
      {venue.broadcasts.map((b) => {
        const start = new Date(b.startAt)
        const dateStr = start.toLocaleDateString('fi-FI', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
        const timeStr = start.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
        return (
          <li key={b.id} className="studio-item-row--list">
            <div className="studio-flex-1">
              <span className="studio-text-sm">
                {dateStr} at {timeStr}
              </span>
              {b.description && (
                <span className="studio-text-muted-sm studio-ml-sm">{b.description}</span>
              )}
            </div>
            <button
              type="button"
              className="studio-btn-ghost studio-btn-sm studio-text-error"
              onClick={() => cancel(b.id)}
            >
              Cancel
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function AddBroadcastForm({
  venue,
  onVenueUpdate,
}: {
  venue: Venue
  onVenueUpdate: (v: Venue) => void
}) {
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [desc, setDesc] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!startAt) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/v1/venues/${venue.slug}/broadcasts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startAt: new Date(startAt).toISOString(),
          endAt: endAt ? new Date(endAt).toISOString() : undefined,
          description: desc.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setError(err.error ?? 'Failed to add broadcast')
      } else {
        const broadcast = (await res.json()) as VenueBroadcast
        onVenueUpdate({
          ...venue,
          broadcasts: [...venue.broadcasts, broadcast].sort(
            (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
          ),
        })
        setStartAt('')
        setEndAt('')
        setDesc('')
      }
    } catch {
      setError('Network error')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="venue-broadcast-form">
      <div className="studio-label studio-mb-xs">Add broadcast</div>
      <div className="venue-broadcast-form__fields">
        <label className="studio-field--block">
          <span className="studio-label-sm">Start</span>
          <input
            type="datetime-local"
            className="studio-input studio-input-sm studio-mt-xs"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            required
          />
        </label>
        <label className="studio-field--block">
          <span className="studio-label-sm">End (optional)</span>
          <input
            type="datetime-local"
            className="studio-input studio-input-sm studio-mt-xs"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
          />
        </label>
        <label className="studio-field--block">
          <span className="studio-label-sm">Description</span>
          <input
            type="text"
            className="studio-input studio-input-sm studio-mt-xs"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            maxLength={500}
            placeholder="Optional note"
          />
        </label>
      </div>
      <button
        type="submit"
        className="studio-btn-primary studio-btn-sm studio-mt-sm"
        disabled={pending || !startAt}
      >
        {pending ? 'Adding…' : 'Add broadcast'}
      </button>
      {error && <p className="studio-text-error studio-text-sm studio-mt-xs">{error}</p>}
    </form>
  )
}
