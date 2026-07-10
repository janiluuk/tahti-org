// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { ButtonIcon, Button, Panel } from '@tahti/ui'
import type { ArtistEventView } from '@tahti/shared'
import { createEvent, deleteEvent } from './actions'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function EventsManager({ initialEvents }: { initialEvents: ArtistEventView[] }) {
  const [events, setEvents] = useState(initialEvents)
  const [title, setTitle] = useState('')
  const [place, setPlace] = useState('')
  const [location, setLocation] = useState('')
  const [eventUrl, setEventUrl] = useState('')
  const [startAt, setStartAt] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    if (!title.trim() || !place.trim() || !location.trim() || !startAt) {
      setError('Title, place, location, and date are required.')
      return
    }
    setPending(true)
    setError(null)
    const result = await createEvent({
      title: title.trim(),
      place: place.trim(),
      location: location.trim(),
      eventUrl: eventUrl.trim() || undefined,
      startAt: new Date(startAt).toISOString(),
    })
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.event) {
      setEvents((prev) =>
        [...prev, result.event!].sort((a, b) => a.startAt.localeCompare(b.startAt)),
      )
      setTitle('')
      setPlace('')
      setLocation('')
      setEventUrl('')
      setStartAt('')
    }
  }

  async function remove(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id))
    await deleteEvent(id)
  }

  return (
    <Panel title="Upcoming events" headerTight>
      {events.length === 0 ? (
        <p className="studio-text-muted-sm studio-mb-md">Nothing scheduled yet — add one below.</p>
      ) : (
        <ul className="studio-list studio-mb-md">
          {events.map((e) => (
            <li key={e.id} className="studio-item-row--list">
              <div className="studio-flex-1">
                <div className="studio-text-sm">
                  <strong>{e.title}</strong> — {e.place}, {e.location}
                </div>
                <div className="studio-text-muted-sm">
                  {fmtDate(e.startAt)}
                  {e.eventUrl && (
                    <>
                      {' · '}
                      <a
                        href={e.eventUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="studio-link"
                      >
                        Tickets / event link ↗
                      </a>
                    </>
                  )}
                </div>
              </div>
              <Button
                onClick={() => remove(e.id)}
                variant="ghost"
                size="sm"
                className="studio-text-error"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="studio-grid studio-grid--2">
        <label className="studio-field">
          <span className="studio-label">Title</span>
          <input
            type="text"
            placeholder="e.g. Warehouse Session"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="studio-input"
          />
        </label>
        <label className="studio-field">
          <span className="studio-label">Date &amp; time</span>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className="studio-input"
          />
        </label>
        <label className="studio-field">
          <span className="studio-label">Place</span>
          <input
            type="text"
            placeholder="e.g. Kulttuuritalo"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            className="studio-input"
          />
        </label>
        <label className="studio-field">
          <span className="studio-label">Location</span>
          <input
            type="text"
            placeholder="e.g. Helsinki, Finland"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="studio-input"
          />
        </label>
      </div>
      <label className="studio-field studio-mt-sm">
        <span className="studio-label">Tickets / event link (optional)</span>
        <input
          type="url"
          placeholder="https://…"
          value={eventUrl}
          onChange={(e) => setEventUrl(e.target.value)}
          className="studio-input"
        />
      </label>

      <Button onClick={add} disabled={pending} variant="primary" className="studio-mt-sm">
        <ButtonIcon name="plus" />
        {pending ? 'Adding…' : 'Add event'}
      </Button>
      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
    </Panel>
  )
}
